import { describe, it, expect } from "vitest";
import {
  applyEdits,
  hasChanges,
  moveItem,
  newDraftTask,
  previewClamps,
  toDraft,
  type DraftWorkload,
} from "./workloadEdit";
import type { ActiveWorkload } from "./types";

const original: ActiveWorkload = {
  id: "w1",
  name: "Finals",
  tasks: [
    { id: "a", name: "Read", total: 10, completed: 8 },
    { id: "b", name: "Practice", total: 4, completed: 1 },
    { id: "c", name: "Review", total: 6, completed: 0 },
  ],
  startedAt: "2026-01-01T00:00:00.000Z",
  cumulativeWater: 25,
};

function draft(overrides: Partial<DraftWorkload> = {}): DraftWorkload {
  return { ...toDraft(original), ...overrides };
}

describe("toDraft", () => {
  it("copies name and tasks, with totals as input strings", () => {
    expect(toDraft(original)).toEqual({
      name: "Finals",
      tasks: [
        { id: "a", name: "Read", total: "10", completed: 8 },
        { id: "b", name: "Practice", total: "4", completed: 1 },
        { id: "c", name: "Review", total: "6", completed: 0 },
      ],
    });
  });
});

describe("moveItem", () => {
  it("moves an item down and up", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("ignores no-op and out-of-range moves", () => {
    const input = ["a", "b", "c"];
    expect(moveItem(input, 1, 1)).toBe(input);
    expect(moveItem(input, -1, 1)).toBe(input);
    expect(moveItem(input, 0, 3)).toBe(input);
    expect(moveItem(input, 5, 0)).toBe(input);
  });
});

describe("applyEdits", () => {
  it("returns an equivalent workload when nothing changed", () => {
    const result = applyEdits(original, draft());

    expect(result).toEqual({ ok: true, workload: original, clamped: [] });
  });

  it("keeps id, startedAt and cumulativeWater", () => {
    const result = applyEdits(original, draft({ name: "Midterms" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workload).toMatchObject({
      id: "w1",
      name: "Midterms",
      startedAt: original.startedAt,
      cumulativeWater: 25,
    });
  });

  it("trims the workload and task names", () => {
    const d = draft({ name: "  New name  " });
    d.tasks[0].name = "  Read ch. 1  ";

    const result = applyEdits(original, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workload.name).toBe("New name");
    expect(result.workload.tasks[0].name).toBe("Read ch. 1");
  });

  it("applies the new task order", () => {
    const d = draft();
    d.tasks = moveItem(d.tasks, 0, 2);

    const result = applyEdits(original, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workload.tasks.map((t) => t.id)).toEqual(["b", "c", "a"]);
    // Progress travels with the task.
    expect(result.workload.tasks[2].completed).toBe(8);
  });

  it("adds new tasks with zero progress", () => {
    const d = draft();
    d.tasks.push({ ...newDraftTask("new1"), name: "Flashcards", total: "20" });

    const result = applyEdits(original, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workload.tasks).toHaveLength(4);
    expect(result.workload.tasks[3]).toEqual({
      id: "new1",
      name: "Flashcards",
      total: 20,
      completed: 0,
    });
  });

  it("removes tasks", () => {
    const d = draft();
    d.tasks = d.tasks.filter((t) => t.id !== "b");

    const result = applyEdits(original, d);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workload.tasks.map((t) => t.id)).toEqual(["a", "c"]);
  });

  describe("lowering a total below completed", () => {
    it("clamps completed to the new total and reports it", () => {
      const d = draft();
      d.tasks[0].total = "5"; // completed was 8

      const result = applyEdits(original, d);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.workload.tasks[0]).toMatchObject({
        total: 5,
        completed: 5,
      });
      expect(result.clamped).toEqual([
        { taskId: "a", name: "Read", from: 8, to: 5 },
      ]);
    });

    it("doesn't clamp when the new total equals completed", () => {
      const d = draft();
      d.tasks[0].total = "8";

      const result = applyEdits(original, d);

      expect(result.ok && result.clamped).toEqual([]);
    });

    it("doesn't touch completed when the total goes up", () => {
      const d = draft();
      d.tasks[0].total = "50";

      const result = applyEdits(original, d);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.workload.tasks[0].completed).toBe(8);
      expect(result.clamped).toEqual([]);
    });
  });

  describe("validation", () => {
    it("rejects an empty workload name", () => {
      const result = applyEdits(original, draft({ name: "   " }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.join(" ")).toMatch(/Workload name/);
    });

    it("rejects a workload name over 200 characters", () => {
      const result = applyEdits(original, draft({ name: "x".repeat(201) }));

      expect(result.ok).toBe(false);
    });

    it("rejects a task with no name and says which one", () => {
      const d = draft();
      d.tasks[1].name = " ";

      const result = applyEdits(original, d);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatch(/Task 2 name/);
    });

    it.each(["", "  ", "abc", "0", "-3", "2.5", "1e3"])(
      "rejects the total %j",
      (total) => {
        const d = draft();
        d.tasks[0].total = total;

        const result = applyEdits(original, d);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.errors[0]).toMatch(/"Read"/);
      }
    );

    it("rejects a total above the schema limit", () => {
      const d = draft();
      d.tasks[0].total = "100001";

      const result = applyEdits(original, d);

      expect(result.ok).toBe(false);
    });

    it("accepts the maximum total", () => {
      const d = draft();
      d.tasks[0].total = "100000";

      expect(applyEdits(original, d).ok).toBe(true);
    });

    it("requires at least one task", () => {
      const result = applyEdits(original, draft({ tasks: [] }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatch(/at least one task/);
    });

    it("rejects more than 200 tasks", () => {
      const tasks = Array.from({ length: 201 }, (_, i) => ({
        ...newDraftTask(`t${i}`),
        name: `Task ${i}`,
        total: "1",
      }));

      const result = applyEdits(original, draft({ tasks }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.join(" ")).toMatch(/Too many tasks/);
    });

    it("reports every bad row, not just the first", () => {
      const d = draft();
      d.tasks[0].total = "x";
      d.tasks[2].total = "";

      const result = applyEdits(original, d);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toHaveLength(2);
    });
  });
});

describe("previewClamps", () => {
  it("lists tasks whose typed total is below completed", () => {
    const d = draft();
    d.tasks[0].total = "3";
    d.tasks[1].total = "4";

    expect(previewClamps(d.tasks)).toEqual(new Map([["a", 3]]));
  });

  it("ignores half-typed or invalid totals", () => {
    const d = draft();
    d.tasks[0].total = "";
    d.tasks[1].total = "abc";
    d.tasks[2].total = "0";

    expect(previewClamps(d.tasks).size).toBe(0);
  });
});

describe("hasChanges", () => {
  it("is false for an untouched draft", () => {
    expect(hasChanges(original, draft())).toBe(false);
  });

  it("detects renames, edits, additions, removals and reordering", () => {
    expect(hasChanges(original, draft({ name: "Other" }))).toBe(true);

    const edited = draft();
    edited.tasks[0].total = "11";
    expect(hasChanges(original, edited)).toBe(true);

    const added = draft();
    added.tasks.push(newDraftTask("n"));
    expect(hasChanges(original, added)).toBe(true);

    const removed = draft();
    removed.tasks.pop();
    expect(hasChanges(original, removed)).toBe(true);

    const reordered = draft();
    reordered.tasks = moveItem(reordered.tasks, 0, 1);
    expect(hasChanges(original, reordered)).toBe(true);
  });

  it("ignores whitespace-only differences", () => {
    expect(hasChanges(original, draft({ name: "  Finals " }))).toBe(false);
  });
});
