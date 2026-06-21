import type { Task, PlantInfo, PlantStage } from "./types";

export function calculateWater(tasks: Task[], cumulativeWater: number = 0): number {
  if (tasks.length === 0) return Math.min(cumulativeWater, 100);

  const percentages = tasks.map((t) =>
    t.total > 0 ? Math.min((t.completed / t.total) * 100, 100) : 0
  );

  const average =
    percentages.reduce((sum, p) => sum + p, 0) / percentages.length;

  // Cumulative water blends carried-over progress with current workload
  const blended = Math.round((cumulativeWater + average) / (cumulativeWater > 0 ? 2 : 1));
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