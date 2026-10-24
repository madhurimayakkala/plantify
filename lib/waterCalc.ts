import type { Task, PlantInfo, PlantStage } from "./types";

/**
 * Water % for the current cycle, from 0 to 100.
 *
 * Step 1: average each task's completion (completed / total, capped at 100%
 * per task). A task with total 0 counts as 0% but still counts in the
 * average. With no tasks, the result is just the carried-over water.
 *
 * Step 2: blend in `cumulativeWater`, the water carried over when the user
 * chose "continue" at the end of a previous cycle.
 *
 *   cumulativeWater === 0  ->  average
 *   cumulativeWater  >  0  ->  (cumulativeWater + average) / 2
 *
 * NOTE: this is a plain two-way average, so carried progress is HALVED
 * every cycle: with no new work, 80 becomes 40, then 20, then 10. Old
 * progress therefore fades geometrically, and new work always carries half
 * the weight of the final number. A side effect is a jump at zero: carried
 * water of 0 means "no blend" (a perfect cycle scores 100), while carried
 * water of 1 means "blend" (the same cycle scores 51).
 *
 * This is the app's current, intended-to-be-preserved behavior; it is
 * locked in by tests in waterCalc.test.ts. Change it only on purpose.
 *
 * Results are rounded to an integer and capped at 100.
 */
export function calculateWater(
  tasks: Task[],
  cumulativeWater: number = 0
): number {
  if (tasks.length === 0) return Math.min(cumulativeWater, 100);

  const percentages = tasks.map((t) =>
    t.total > 0 ? Math.min((t.completed / t.total) * 100, 100) : 0
  );

  const average =
    percentages.reduce((sum, p) => sum + p, 0) / percentages.length;

  // Cumulative water blends carried-over progress with current workload
  const blended = Math.round(
    (cumulativeWater + average) / (cumulativeWater > 0 ? 2 : 1)
  );
  return Math.min(blended, 100);
}

export function getPlantInfo(water: number): PlantInfo {
  if (water <= 20) {
    return { stage: "seed", emoji: "🌰", label: "Seed" };
  } else if (water <= 40) {
    return { stage: "sprout", emoji: "🌱", label: "Sprout" };
  } else if (water <= 60) {
    return { stage: "growing", emoji: "🌿", label: "Growing" };
  } else if (water <= 80) {
    return { stage: "blooming", emoji: "🌾", label: "Blooming" };
  } else {
    return { stage: "tree", emoji: "🌳", label: "Full Tree" };
  }
}

export function getStageColor(stage: PlantStage): string {
  const map: Record<PlantStage, string> = {
    seed: "#c4a882",
    sprout: "#7cb87a",
    growing: "#3d6b35",
    blooming: "#d4b483",
    tree: "#2d5a1f",
  };
  return map[stage];
}

export function getWaterColor(water: number): string {
  if (water <= 20) return "#c4a882";
  if (water <= 40) return "#7cb87a";
  if (water <= 60) return "#3d6b35";
  if (water <= 80) return "#d4a94e";
  return "#2d5a1f";
}

export function formatWaterBreakdown(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks yet";
  return tasks
    .map((t) => {
      const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
      return `${t.name}: ${pct}%`;
    })
    .join(" · ");
}
