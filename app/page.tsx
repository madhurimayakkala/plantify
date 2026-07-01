// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import WelcomeScreen from "@/components/WelcomeScreen";
import ActivePlant from "@/components/ActivePlant";
import WorkloadPanel from "@/components/WorkloadPanel";
import CreateWorkloadModal from "@/components/CreateWorkloadModal";
import EndCycleModal from "@/components/EndCycleModal";

import {
  calculateWater,
  getPlantInfo,
} from "@/lib/waterCalc";

import {
  isGuestMode,
  enableGuestMode,
  getGuestWorkload,
  setGuestWorkload,
  deleteGuestWorkload,
  addGuestGardenEntry,
} from "@/lib/guestStorage";

import type {
  ActiveWorkload,
  EndCycleChoice,
  GardenEntry,
} from "@/lib/types";

const WORKLOAD_SAVE_DEBOUNCE_MS = 500;

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();

  const [guestChecked, setGuestChecked] = useState(false);
  const [guest, setGuest] = useState(false);

  const [workload, setWorkloadState] =
    useState<ActiveWorkload | null>(null);

  const [createOpen, setCreateOpen] =
    useState(false);

  const [endCycleOpen, setEndCycleOpen] =
    useState(false);

  // Last state we know is actually persisted (server or guest storage).
  // Used to roll the UI back if a save fails.
  const lastSyncedRef = useRef<ActiveWorkload | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for a local guest session once on mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    setGuest(isGuestMode());
    setGuestChecked(true);
  }, []);

  const usingGuestData = guest && !isSignedIn;

  useEffect(() => {
    if (!isLoaded || !guestChecked) return;
    if (!isSignedIn && !guest) return; // nothing to load yet, still on the welcome screen

    async function loadWorkload() {
      if (usingGuestData) {
        const active = getGuestWorkload();

        if (active) {
          setWorkloadState(active);
          lastSyncedRef.current = active;
        } else {
          setCreateOpen(true);
        }

        return;
      }

      try {
        const res = await fetch("/api/workload");

        if (!res.ok) {
          setCreateOpen(true);
          return;
        }

        const active = await res.json();

        if (active) {
          const loaded: ActiveWorkload = {
            id:
              active.id ??
              crypto.randomUUID(),
            name: active.name,
            tasks: active.tasks,
            startedAt: active.started_at,
            cumulativeWater:
              active.cumulative_water,
          };

          setWorkloadState(loaded);
          lastSyncedRef.current = loaded;
        } else {
          setCreateOpen(true);
        }
      } catch (error) {
        console.error("Failed to load workload:", error);
        toast.error("Couldn't load your workload", {
          description: "Check your connection and refresh the page.",
        });
        setCreateOpen(true);
      }
    }

    loadWorkload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, guestChecked, isSignedIn, guest]);

  // Clear any pending debounced save if the component unmounts mid-type.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function persistWorkload(
    updated: ActiveWorkload,
    { onFailRetry }: { onFailRetry: () => void }
  ) {
    if (usingGuestData) {
      setGuestWorkload(updated);
      lastSyncedRef.current = updated;
      return;
    }

    try {
      const res = await fetch("/api/workload", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: updated.name,
          tasks: updated.tasks,
          started_at: updated.startedAt,
          cumulative_water: updated.cumulativeWater,
        }),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }

      lastSyncedRef.current = updated;
    } catch (error) {
      console.error("Failed to save workload:", error);

      // Roll the UI back to the last state we know actually saved,
      // so the user isn't looking at progress that silently didn't persist.
      setWorkloadState(lastSyncedRef.current);

      toast.error("Couldn't save your progress", {
        description: "Your last change wasn't saved. Try again?",
        action: {
          label: "Retry",
          onClick: onFailRetry,
        },
      });
    }
  }

  // Used for one-off, immediate saves (creating/continuing a workload) —
  // persists right away, no debounce.
  async function setWorkload(updated: ActiveWorkload) {
    setWorkloadState(updated);
    await persistWorkload(updated, {
      onFailRetry: () => setWorkload(updated),
    });
  }

  // Used by the task counter in WorkloadPanel, which can fire many times a
  // second. Updates the UI immediately (optimistic) but only sends one
  // network request after the user pauses, so rapid taps collapse into a
  // single write instead of racing each other.
  function updateWorkload(updated: ActiveWorkload) {
    setWorkloadState(updated);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      persistWorkload(updated, {
        onFailRetry: () => updateWorkload(updated),
      });
    }, WORKLOAD_SAVE_DEBOUNCE_MS);
  }

  async function saveWorkload(
    workloadData: ActiveWorkload
  ) {
    await setWorkload(workloadData);
    setCreateOpen(false);
  }

  async function handleEndChoice(
    choice: EndCycleChoice
  ) {
    if (!workload) return;

    const water = calculateWater(
      workload.tasks,
      workload.cumulativeWater
    );

    const plant = getPlantInfo(water);

    if (choice === "save_reset") {
      const totalTasks =
        workload.tasks.reduce(
          (sum, task) =>
            sum + task.total,
          0
        );

      const completedTasks =
        workload.tasks.reduce(
          (sum, task) =>
            sum + task.completed,
          0
        );

      const gardenEntry: GardenEntry =
        {
          id: crypto.randomUUID(),
          workloadName:
            workload.name,
          savedAt:
            new Date().toISOString(),
          waterPercent: water,
          stage: plant.stage,
          stageEmoji:
            plant.emoji,
          tasksCompleted:
            completedTasks,
          tasksTotal: totalTasks,
        };

      let gardenSaveFailed = false;

      if (usingGuestData) {
        addGuestGardenEntry(gardenEntry);
        deleteGuestWorkload();
      } else {
        try {
          const res = await fetch("/api/garden", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gardenEntry),
          });

          if (!res.ok) {
            throw new Error("Failed to save garden entry");
          }
        } catch (error) {
          console.error(
            "Failed to save garden entry:",
            error
          );
          gardenSaveFailed = true;
        }

        try {
          await fetch(
            "/api/workload",
            {
              method: "DELETE",
            }
          );
        } catch (error) {
          console.error(
            "Failed to delete workload:",
            error
          );
        }
      }

      setWorkloadState(null);
      lastSyncedRef.current = null;

      setEndCycleOpen(false);

      setCreateOpen(true);

      if (gardenSaveFailed) {
        toast.error("Your plant wasn't saved to the garden", {
          description: "Something went wrong on our end — sorry about that.",
        });
      } else {
        toast.success(`${plant.emoji} Saved to your garden!`, {
          description: `${workload.name} reached ${water}% growth.`,
        });
      }
    }

    if (choice === "continue") {
      const currentWater =
        calculateWater(
          workload.tasks,
          workload.cumulativeWater
        );

      const updated: ActiveWorkload =
        {
          ...workload,
          cumulativeWater:
            currentWater,
        };

      await setWorkload(updated);

      setEndCycleOpen(false);

      setCreateOpen(true);
    }

    if (choice === "reset") {
      if (usingGuestData) {
        deleteGuestWorkload();
      } else {
        try {
          await fetch(
            "/api/workload",
            {
              method: "DELETE",
            }
          );
        } catch (error) {
          console.error(
            "Failed to delete workload:",
            error
          );
        }
      }

      setWorkloadState(null);
      lastSyncedRef.current = null;

      setEndCycleOpen(false);

      setCreateOpen(true);
    }
  }

  function handleContinueAsGuest() {
    enableGuestMode();
    setGuest(true);
  }

  // Wait for Clerk + the local guest check before deciding what to render,
  // so we never flash the welcome screen at an already-authenticated user.
  if (!isLoaded || !guestChecked) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#fefcf7" }}
      >
        <p style={{ color: "#9b8878" }}>Loading...</p>
      </main>
    );
  }

  if (!isSignedIn && !guest) {
    return <WelcomeScreen onGuest={handleContinueAsGuest} />;
  }

  const water = workload
    ? calculateWater(
        workload.tasks,
        workload.cumulativeWater
      )
    : 0;

  const plant = getPlantInfo(water);

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg,#fefcf7 0%,#f4faf2 100%)",
      }}
    >
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div>
          <h1
            className="text-4xl font-bold"
            style={{
              color: "#2d1b0e",
              fontFamily:
                "'Lora', Georgia, serif",
            }}
          >
            Plantify 🌿
          </h1>

          <p
            className="mt-2 text-sm"
            style={{
              color: "#6b5a4a",
            }}
          >
            Water your plant by finishing
            workloads and growing
            progress.
          </p>
        </div>

        <ActivePlant
          workload={workload}
          onEndCycle={() =>
            setEndCycleOpen(true)
          }
          onCreateWorkload={() =>
            setCreateOpen(true)
          }
        />

        {workload && (
          <WorkloadPanel
            workload={workload}
            onUpdate={updateWorkload}
          />
        )}
      </div>

      <CreateWorkloadModal
        open={createOpen}
        existingWorkload={workload}
        onClose={() =>
          setCreateOpen(false)
        }
        onSave={saveWorkload}
      />

      <EndCycleModal
        open={endCycleOpen}
        workload={workload}
        onClose={() =>
          setEndCycleOpen(false)
        }
        onChoose={handleEndChoice}
      />
    </main>
  );
}