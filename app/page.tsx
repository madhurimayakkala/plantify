"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ActivePlant from "@/components/ActivePlant";
import WorkloadPanel from "@/components/WorkloadPanel";
import CreateWorkloadModal from "@/components/CreateWorkloadModal";
import EndCycleModal from "@/components/EndCycleModal";

import {
  setActive,
  clearActive,
  saveToGarden,
} from "@/lib/storage";

import {
  calculateWater,
  getPlantInfo,
} from "@/lib/waterCalc";

import type {
  ActiveWorkload,
  EndCycleChoice,
  GardenEntry,
} from "@/lib/types";

export default function HomePage() {
  const [workload, setWorkloadState] =
    useState<ActiveWorkload | null>(null);

  const [createOpen, setCreateOpen] =
    useState(false);

  const [endCycleOpen, setEndCycleOpen] =
    useState(false);

  useEffect(() => {
    async function loadWorkload() {
      try {
       const res = await fetch("/api/workload");

if (!res.ok) {
  setCreateOpen(true);
  return;
}

const active = await res.json();

        if (active) {
          setWorkloadState({
            id:
              active.id ??
              crypto.randomUUID(),
            name: active.name,
            tasks: active.tasks,
            startedAt: active.started_at,
            cumulativeWater:
              active.cumulative_water,
          });
        } else {
          setCreateOpen(true);
        }
      } catch (error) {
        console.error(error);
        setCreateOpen(true);
      }
    }

    loadWorkload();
  }, []);

  

  function updateWorkload(
  updated: ActiveWorkload
) {
  console.log("UPDATE FIRED");
  console.log(updated);

  void setWorkload(updated);
}
    
  async function setWorkload(
    updated: ActiveWorkload
  ) {
    setWorkloadState(updated);

    try {
      await fetch("/api/workload", {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          name: updated.name,
          tasks: updated.tasks,
          started_at:
            updated.startedAt,
          cumulative_water:
            updated.cumulativeWater,
        }),
      });
    } catch (error) {
      console.error(
        "Failed to save workload:",
        error
      );
    }

    // temporary backup during migration
    setActive(updated);
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

      try {
        await fetch("/api/garden", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            gardenEntry
          ),
        });
      } catch (error) {
        console.error(
          "Failed to save garden entry:",
          error
        );
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

      // temporary backup during migration
      saveToGarden(gardenEntry);

      clearActive();

      setWorkloadState(null);

      setEndCycleOpen(false);

      setCreateOpen(true);
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

      clearActive();

      setWorkloadState(null);

      setEndCycleOpen(false);

      setCreateOpen(true);
    }
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