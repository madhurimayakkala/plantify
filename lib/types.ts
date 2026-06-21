export interface Task {
  id: string;
  name: string;
  total: number;
  completed: number;
}

export interface ActiveWorkload {
  id: string;
  name: string;
  tasks: Task[];
  startedAt: string;
  cumulativeWater: number;
}

export interface GardenEntry {
  id: string;
  workloadName: string;
  savedAt: string;
  waterPercent: number;
  stage: string;
  stageEmoji: string;
  tasksCompleted: number;
  tasksTotal: number;
}

export type PlantStage = "seed" | "sprout" | "growing" | "blooming" | "tree";

export interface PlantInfo {
  stage: PlantStage;
  emoji: string;
  label: string;
}

export type EndCycleChoice = "save_reset" | "continue" | "reset";