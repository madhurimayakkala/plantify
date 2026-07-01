// lib/validation.ts
import { NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";

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
  id: z.string().min(1, "id is required"),
  workloadName: z.string().trim().min(1, "workloadName is required").max(200),
  savedAt: z.string().min(1, "savedAt is required"),
  waterPercent: z.number().min(0).max(100),
  stage: plantStageSchema,
  stageEmoji: z.string().min(1).max(8),
  tasksCompleted: z.number().int().min(0),
  tasksTotal: z.number().int().min(0),
});

/**
 * Safely parses a request body as JSON and validates it against a Zod
 * schema in one step. Handles malformed JSON (which previously caused an
 * unhandled exception / bare 500) and shape mismatches, returning a
 * descriptive 400 for either.
 */
export async function parseAndValidate<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(json);

  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}