// lib/schemas.ts
//
// Zod schemas shared by the API routes (server) and the editing UI (client).
// This file must stay free of server-only imports (like next/server) so it
// can be bundled into client components. It is the single source of truth for
// workload and garden limits.
import { z } from "zod";

export const taskSchema = z
  .object({
    id: z.string().min(1, "Task id is required"),
    name: z.string().trim().min(1, "Task name is required").max(200),
    total: z.number().int().min(1).max(100_000),
    completed: z.number().int().min(0),
  })
  .refine((task) => task.completed <= task.total, {
    message: "completed cannot exceed total",
    path: ["completed"],
  });

export const workloadPutSchema = z.object({
  name: z.string().trim().min(1, "Workload name is required").max(200),
  tasks: z.array(taskSchema).max(200, "Too many tasks"),
  started_at: z.string().min(1, "started_at is required"),
  cumulative_water: z.number().min(0).max(100),
});

export const plantStageSchema = z.enum([
  "seed",
  "sprout",
  "growing",
  "blooming",
  "tree",
]);

export const gardenPostSchema = z.object({
  id: z.string().uuid("id must be a UUID"),
  workloadName: z.string().trim().min(1, "workloadName is required").max(200),
  savedAt: z.string().min(1, "savedAt is required"),
  waterPercent: z.number().min(0).max(100),
  stage: plantStageSchema,
  stageEmoji: z.string().min(1).max(8),
  tasksCompleted: z.number().int().min(0),
  tasksTotal: z.number().int().min(0),
});

/**
 * Rules for a workload after the user edits it: same limits as a normal save,
 * plus at least one task (a plant with nothing to water makes no sense).
 */
export const editedWorkloadSchema = workloadPutSchema.extend({
  tasks: z
    .array(taskSchema)
    .min(1, "A workload needs at least one task")
    .max(200, "Too many tasks"),
});
