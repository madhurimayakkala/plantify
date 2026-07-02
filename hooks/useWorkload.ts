// hooks/useWorkload.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import { calculateWater, getPlantInfo } from "@/lib/waterCalc";

import {
  isGuestMode,
  enableGuestMode,
  exitGuestMode,
  getGuestWorkload,
  setGuestWorkload,
  deleteGuestWorkload,
  getGuestGarden,
  addGuestGardenEntry,
} from "@/lib/guestStorage";

import type {
  ActiveWorkload,
  EndCycleChoice,
  GardenEntry,
} from "@/lib/types";

const WORKLOAD_SAVE_DEBOUNCE_MS = 500;

export function useWorkload() {
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

  // Ensures we only ever attempt guest -> account migration once per
  // mounted session, even if this effect re-runs for other reasons.
  const migrationAttemptedRef = useRef(false);

  // Check for a local guest session once on mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    setGuest(isGuestMode());
    setGuestChecked(true);
  }, []);

  const usingGuestData = guest && !isSignedIn;

  /**
   * Copies a guest's local workload + garden entries into their new
   * Supabase account. Called once, at the exact moment a guest becomes
   * signed in.
   *
   * Safety rule: we never overwrite an existing real workload on the
   * server. Garden entries are always safe to add (they never replace
   * existing ones), so those always migrate.
   */
  async function migrateGuestDataToAccount() {
    const localWorkload = getGuestWorkload();
    const localGarden = getGuestGarden();

    const hasDataToMigrate =
      localWorkload !== null || localGarden.length > 0;

    if (!hasDataToMigrate) {
      exitGuestMode();
      return;
    }

    try {
      // Garden entries are additive — always safe to migrate.
      for (const entry of localGarden) {
        await fetch("/api/garden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      }

      // Only migrate the active workload if this account doesn't
      // already have one — never overwrite real, existing progress.
      if (localWorkload) {
        const existingRes = await fetch("/api/workload");
        const existing = existingRes.ok
          ? await existingRes.json()
          : null;

        if (!existing) {
          await fetch("/api/workload", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: localWorkload.name,
              tasks: localWorkload.tasks,
              started_at: localWorkload.startedAt,
              cumulative_water: localWorkload.cumulativeWater,
            }),
          });
        }
      }

      exitGuestMode();

      toast.success("Your guest progress has been saved!", {
        description:
          "We moved your active workload and garden into your new account.",
      });
    } catch (error) {
      console.error("Failed to migrate guest data:", error);

      // On failure, we deliberately do NOT clear local guest storage —
      // the data stays safely on this device, and since we don't clear
      // the guest flag either, a page refresh will naturally retry the
      // migration next time this hook runs.
      toast.error("We couldn't save all of your guest progress", {
        description:
          "Your data is still on this device. Try refreshing the page.",
      });
    }
  }

  useEffect(() => {
    if (!isLoaded || !guestChecked) return;
    if (!isSignedIn && !guest) return; // nothing to load yet, still on the welcome screen

    async function run() {
      // If this is a guest who just signed in, migrate their local
      // data into their new account first, then let the normal load
      // path (below, in a future run of this effect) take over.
      if (
        isSignedIn &&
        guest &&
        !migrationAttemptedRef.current
      ) {
        migrationAttemptedRef.current = true;
        await migrateGuestDataToAccount();
        setGuest(false); // triggers this effect to re-run with fresh, correct state
        return;
      }

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

    run();
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

  return {
    // Auth / guest state — needed to decide what to render
    isLoaded,
    isSignedIn,
    guestChecked,
    guest,

    // Workload data
    workload,

    // Modal open/close state
    createOpen,
    setCreateOpen,
    endCycleOpen,
    setEndCycleOpen,

    // Actions
    updateWorkload,
    saveWorkload,
    handleEndChoice,
    handleContinueAsGuest,
  };
}