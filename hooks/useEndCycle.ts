// hooks/useEndCycle.ts
"use client";

import { toast } from "sonner";

import { calculateWater, getPlantInfo } from "@/lib/waterCalc";
import { addGuestGardenEntry, deleteGuestWorkload } from "@/lib/guestStorage";
import type { ActiveWorkload, EndCycleChoice, GardenEntry } from "@/lib/types";

interface UseEndCycleOptions {
  workload: ActiveWorkload | null;
  usingGuestData: boolean;
  setWorkload: (workload: ActiveWorkload) => Promise<void>;
  clearWorkload: () => void;
  closeEndCycle: () => void;
  openCreate: () => void;
}

/** Handles the three ways to finish a cycle: save & reset, continue, reset. */
export function useEndCycle({
  workload,
  usingGuestData,
  setWorkload,
  clearWorkload,
  closeEndCycle,
  openCreate,
}: UseEndCycleOptions) {
  async function handleEndChoice(choice: EndCycleChoice) {
    if (!workload) return;

    const water = calculateWater(workload.tasks, workload.cumulativeWater);

    const plant = getPlantInfo(water);

    if (choice === "save_reset") {
      const totalTasks = workload.tasks.reduce(
        (sum, task) => sum + task.total,
        0
      );

      const completedTasks = workload.tasks.reduce(
        (sum, task) => sum + task.completed,
        0
      );

      const gardenEntry: GardenEntry = {
        id: crypto.randomUUID(),
        workloadName: workload.name,
        savedAt: new Date().toISOString(),
        waterPercent: water,
        stage: plant.stage,
        stageEmoji: plant.emoji,
        tasksCompleted: completedTasks,
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
          console.error("Failed to save garden entry:", error);
          gardenSaveFailed = true;
        }

        try {
          await fetch("/api/workload", {
            method: "DELETE",
          });
        } catch (error) {
          console.error("Failed to delete workload:", error);
        }
      }

      clearWorkload();

      closeEndCycle();

      openCreate();

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
      const currentWater = calculateWater(
        workload.tasks,
        workload.cumulativeWater
      );

      const updated: ActiveWorkload = {
        ...workload,
        cumulativeWater: currentWater,
      };

      await setWorkload(updated);

      closeEndCycle();

      openCreate();
    }

    if (choice === "reset") {
      if (usingGuestData) {
        deleteGuestWorkload();
      } else {
        try {
          await fetch("/api/workload", {
            method: "DELETE",
          });
        } catch (error) {
          console.error("Failed to delete workload:", error);
        }
      }

      clearWorkload();

      closeEndCycle();

      openCreate();
    }
  }

  return { handleEndChoice };
}
