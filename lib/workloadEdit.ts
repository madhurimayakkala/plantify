// lib/workloadEdit.ts
//
// Pure logic behind the "Edit workload" modal: building a draft, reordering
// tasks, and turning a draft back into a validated workload.
//
// Validation rules live in lib/schemas.ts (Zod). This file only parses what
// the form gives us (strings) and then asks Zod, so limits are never
// duplicated here.
import { editedWorkloadSchema } from "./schemas";
import type { ActiveWorkload, Task } from "./types";

export interface DraftTask {
  id: string;
  name: string;
  /** Raw text from the input, so half-typed values don't get rewritten. */
  total: string;
  /** Progress already made. Not editable here, but kept (and clamped). */
  completed: number;
}

export interface DraftWorkload {
  name: string;
  tasks: DraftTask[];
}

export interface ClampedTask {
  taskId: string;
  name: string;
  from: number;
  to: number;
}

export type ApplyEditsResult =
  | {
      ok: true;
      workload: ActiveWorkload;
      /** Tasks whose completed count was lowered to fit a smaller total. */
      clamped: ClampedTask[];
    }
  | { ok: false; errors: string[] };

export function toDraft(workload: ActiveWorkload): DraftWorkload {
  return {
    name: workload.name,
    tasks: workload.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      total: String(task.total),
      completed: task.completed,
    })),
  };
}

export function newDraftTask(id: string): DraftTask {
  return { id, name: "", total: "", completed: 0 };
}

/** Moves one item and returns a new array. Out-of-range moves are no-ops. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }

  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * What the user would lose by saving this draft: any task whose new total is
 * below its completed count. Used to warn before saving. Rows whose total
 * isn't a valid number yet are ignored.
 */
export function previewClamps(tasks: DraftTask[]): Map<string, number> {
  const clamps = new Map<string, number>();

  for (const task of tasks) {
    const total = parseTotal(task.total);
    if (total !== null && total >= 1 && total < task.completed) {
      clamps.set(task.id, total);
    }
  }

  return clamps;
}

function parseTotal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function label(task: DraftTask, index: number): string {
  const name = task.name.trim();
  return name ? `"${name}"` : `Task ${index + 1}`;
}

/**
 * Turns the edited draft into a workload, or explains what's wrong.
 *
 * Lowering a task's total below its completed count clamps completed down to
 * the new total (reported in `clamped`) instead of failing, so the saved data
 * always satisfies the schema's `completed <= total` rule.
 */
export function applyEdits(
  original: ActiveWorkload,
  draft: DraftWorkload
): ApplyEditsResult {
  const errors: string[] = [];
  const tasks: Task[] = [];
  const clamped: ClampedTask[] = [];

  draft.tasks.forEach((draftTask, index) => {
    const total = parseTotal(draftTask.total);

    if (total === null) {
      errors.push(
        `${label(draftTask, index)} needs a whole number total of at least 1.`
      );
      return;
    }

    const completed = Math.min(draftTask.completed, total);

    if (completed < draftTask.completed) {
      clamped.push({
        taskId: draftTask.id,
        name: draftTask.name.trim(),
        from: draftTask.completed,
        to: completed,
      });
    }

    tasks.push({
      id: draftTask.id,
      name: draftTask.name.trim(),
      total,
      completed,
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const parsed = editedWorkloadSchema.safeParse({
    name: draft.name,
    tasks,
    started_at: original.startedAt,
    cumulative_water: original.cumulativeWater,
  });

  if (!parsed.success) {
    return { ok: false, errors: describeIssues(parsed.error.issues, draft) };
  }

  return {
    ok: true,
    clamped,
    workload: {
      ...original,
      name: parsed.data.name,
      tasks: parsed.data.tasks,
    },
  };
}

function describeIssues(
  issues: { path: (string | number)[]; message: string }[],
  draft: DraftWorkload
): string[] {
  const messages = issues.map((issue) => {
    const [section, index, field] = issue.path;

    if (section === "name") {
      return `Workload name: ${issue.message}`;
    }

    if (section === "tasks" && typeof index === "number") {
      const task = draft.tasks[index];
      const who = task ? label(task, index) : `Task ${index + 1}`;
      const where =
        field === "name" ? "name" : field === "total" ? "total" : "";
      return `${who}${where ? ` ${where}` : ""}: ${issue.message}`;
    }

    return issue.message;
  });

  return Array.from(new Set(messages));
}

/** True when saving this draft would change anything. */
export function hasChanges(
  original: ActiveWorkload,
  draft: DraftWorkload
): boolean {
  if (draft.name.trim() !== original.name) return true;
  if (draft.tasks.length !== original.tasks.length) return true;

  return draft.tasks.some((task, index) => {
    const base = original.tasks[index];
    return (
      task.id !== base.id ||
      task.name.trim() !== base.name ||
      task.total.trim() !== String(base.total)
    );
  });
}
