// lib/waterCalc.test.ts
import { describe, it, expect } from "vitest";
import {
  calculateWater,
  getPlantInfo,
  getStageColor,
  getWaterColor,
  formatWaterBreakdown,
} from "./waterCalc";
import type { Task } from "./types";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Task",
    total: overrides.total ?? 10,
    completed: overrides.completed ?? 0,
  };
}

describe("calculateWater", () => {
  it("returns 0 for no tasks and no cumulative water", () => {
    expect(calculateWater([], 0)).toBe(0);
  });

  it("returns the cumulative water, capped at 100, when there are no tasks", () => {
    expect(calculateWater([], 45)).toBe(45);
    expect(calculateWater([], 150)).toBe(100);
  });

  it("averages a single task's completion percentage when cumulative water is 0", () => {
    const tasks = [task({ total: 10, completed: 5 })];
    // average = 50%, cumulativeWater is 0 so it divides by 1, not 2
    expect(calculateWater(tasks, 0)).toBe(50);
  });

  it("returns 100 when a single task is fully complete", () => {
    const tasks = [task({ total: 10, completed: 10 })];
    expect(calculateWater(tasks, 0)).toBe(100);
  });

  it("averages completion percentage across multiple tasks", () => {
    const tasks = [
      task({ id: "a", total: 10, completed: 10 }), // 100%
      task({ id: "b", total: 10, completed: 0 }), // 0%
    ];
    // average = (100 + 0) / 2 = 50
    expect(calculateWater(tasks, 0)).toBe(50);
  });

  it("blends cumulative water with the new average once cumulative water is nonzero", () => {
    const tasks = [task({ total: 10, completed: 5 })]; // 50%
    // blended = round((50 + 50) / 2) = 50
    expect(calculateWater(tasks, 50)).toBe(50);
  });

  it("treats a task with total 0 as 0% instead of dividing by zero", () => {
    const tasks = [task({ total: 0, completed: 0 })];
    expect(calculateWater(tasks, 0)).toBe(0);
  });

  it("caps the final result at 100 even if the blended value would exceed it", () => {
    const tasks = [task({ total: 10, completed: 10 })]; // 100%
    // average = 100, cumulativeWater = 150 (nonzero) -> blended = round((150+100)/2) = 125 -> capped to 100
    expect(calculateWater(tasks, 150)).toBe(100);
  });

  it("never returns a value above 100 for fully-complete tasks with no prior water", () => {
    const tasks = [
      task({ id: "a", total: 5, completed: 5 }),
      task({ id: "b", total: 3, completed: 3 }),
    ];
    expect(calculateWater(tasks, 0)).toBeLessThanOrEqual(100);
  });
});

describe("getPlantInfo", () => {
  it("returns seed for 0-20% water", () => {
    expect(getPlantInfo(0).stage).toBe("seed");
    expect(getPlantInfo(20).stage).toBe("seed");
  });

  it("returns sprout for 21-40% water", () => {
    expect(getPlantInfo(21).stage).toBe("sprout");
    expect(getPlantInfo(40).stage).toBe("sprout");
  });

  it("returns growing for 41-60% water", () => {
    expect(getPlantInfo(41).stage).toBe("growing");
    expect(getPlantInfo(60).stage).toBe("growing");
  });

  it("returns blooming for 61-80% water", () => {
    expect(getPlantInfo(61).stage).toBe("blooming");
    expect(getPlantInfo(80).stage).toBe("blooming");
  });

  it("returns tree for 81-100% water", () => {
    expect(getPlantInfo(81).stage).toBe("tree");
    expect(getPlantInfo(100).stage).toBe("tree");
  });

  it("includes a matching emoji and label for each stage", () => {
    expect(getPlantInfo(10)).toEqual({ stage: "seed", emoji: "🌰", label: "Seed" });
    expect(getPlantInfo(100)).toEqual({ stage: "tree", emoji: "🌳", label: "Full Tree" });
  });
});

describe("getStageColor", () => {
  it("returns a distinct color for every plant stage", () => {
    const stages = ["seed", "sprout", "growing", "blooming", "tree"] as const;
    const colors = stages.map((s) => getStageColor(s));

    // Every stage should resolve to a color, and all colors should be unique
    expect(colors).toHaveLength(5);
    expect(new Set(colors).size).toBe(5);
  });
});

describe("getWaterColor", () => {
  it("changes color across the same breakpoints as getPlantInfo", () => {
    expect(getWaterColor(20)).toBe("#c4a882");
    expect(getWaterColor(40)).toBe("#7cb87a");
    expect(getWaterColor(60)).toBe("#3d6b35");
    expect(getWaterColor(80)).toBe("#d4a94e");
    expect(getWaterColor(100)).toBe("#2d5a1f");
  });
});

describe("formatWaterBreakdown", () => {
  it("returns a fallback message when there are no tasks", () => {
    expect(formatWaterBreakdown([])).toBe("No tasks yet");
  });

  it("formats a single task's completion percentage", () => {
    const tasks = [task({ name: "DSA Sheet", total: 10, completed: 5 })];
    expect(formatWaterBreakdown(tasks)).toBe("DSA Sheet: 50%");
  });

  it("joins multiple tasks with a middle dot separator", () => {
    const tasks = [
      task({ name: "DSA Sheet", total: 10, completed: 10 }),
      task({ name: "Resume", total: 4, completed: 0 }),
    ];
    expect(formatWaterBreakdown(tasks)).toBe("DSA Sheet: 100% · Resume: 0%");
  });

  it("shows 0% for a task with a total of 0 instead of dividing by zero", () => {
    const tasks = [task({ name: "Empty Task", total: 0, completed: 0 })];
    expect(formatWaterBreakdown(tasks)).toBe("Empty Task: 0%");
  });
});