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
    expect(getPlantInfo(10)).toEqual({
      stage: "seed",
      emoji: "🌰",
      label: "Seed",
    });
    expect(getPlantInfo(100)).toEqual({
      stage: "tree",
      emoji: "🌳",
      label: "Full Tree",
    });
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

// ---------------------------------------------------------------------------
// Locked-in behavior of the carry-over blend. These pin down what the code
// does TODAY (including its quirks) so any future change to the formula is a
// deliberate, visible decision. See the comment on calculateWater.
// ---------------------------------------------------------------------------
describe("calculateWater: carry-over blend (locked-in behavior)", () => {
  describe("cumulativeWater = 0", () => {
    it("returns the plain average with no halving", () => {
      expect(calculateWater([task({ total: 10, completed: 6 })], 0)).toBe(60);
    });

    it("defaults cumulativeWater to 0 when omitted", () => {
      expect(calculateWater([task({ total: 10, completed: 6 })])).toBe(60);
    });
  });

  describe("cumulativeWater > 0", () => {
    it("returns the mean of carried water and the current average", () => {
      // (40 + 80) / 2
      expect(calculateWater([task({ total: 10, completed: 8 })], 40)).toBe(60);
    });

    it("halves carried progress when the new cycle has done nothing", () => {
      expect(calculateWater([task({ total: 10, completed: 0 })], 80)).toBe(40);
    });

    it("decays old progress by half each cycle when fed back in", () => {
      const idle = [task({ total: 10, completed: 0 })];
      const cycle1 = calculateWater(idle, 80); // 40
      const cycle2 = calculateWater(idle, cycle1); // 20
      const cycle3 = calculateWater(idle, cycle2); // 10
      expect([cycle1, cycle2, cycle3]).toEqual([40, 20, 10]);
    });

    it("rounds the blended value to the nearest integer", () => {
      // (1 + 0) / 2 = 0.5 -> Math.round -> 1
      expect(calculateWater([task({ total: 10, completed: 0 })], 1)).toBe(1);
      // (0 + 33.33...) -> (1 + 33.33) / 2 = 17.17 -> 17
      expect(calculateWater([task({ total: 3, completed: 1 })], 1)).toBe(17);
    });

    it("is discontinuous at zero: any carried water, however small, halves the new cycle", () => {
      const done = [task({ total: 10, completed: 10 })];
      expect(calculateWater(done, 0)).toBe(100);
      expect(calculateWater(done, 1)).toBe(51); // (1 + 100) / 2 = 50.5 -> 51
    });
  });

  describe("empty tasks", () => {
    it("returns 0 with no carried water", () => {
      expect(calculateWater([], 0)).toBe(0);
    });

    it("returns carried water unchanged (not halved)", () => {
      expect(calculateWater([], 64)).toBe(64);
    });

    it("caps carried water at 100", () => {
      expect(calculateWater([], 250)).toBe(100);
    });
  });

  describe("cap at 100", () => {
    it("caps a blend that would exceed 100", () => {
      // (150 + 100) / 2 = 125 -> 100. (Out of range input, but locked in.)
      expect(calculateWater([task({ total: 10, completed: 10 })], 150)).toBe(
        100
      );
    });

    it("reaches exactly 100 when carried water and progress are both 100", () => {
      expect(calculateWater([task({ total: 5, completed: 5 })], 100)).toBe(100);
    });

    it("treats over-complete tasks as 100%, not more", () => {
      expect(calculateWater([task({ total: 4, completed: 9 })], 0)).toBe(100);
    });
  });

  describe("tasks with total 0", () => {
    it("counts as 0% rather than dividing by zero", () => {
      expect(calculateWater([task({ total: 0, completed: 0 })], 0)).toBe(0);
    });

    it("still counts in the average, dragging it down", () => {
      const tasks = [
        task({ id: "a", total: 10, completed: 10 }),
        task({ id: "b", total: 0, completed: 0 }),
      ];
      expect(calculateWater(tasks, 0)).toBe(50);
    });

    it("blends with carried water like any other 0% task", () => {
      expect(calculateWater([task({ total: 0, completed: 0 })], 60)).toBe(30);
    });
  });
});
