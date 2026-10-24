// lib/validation.ts
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export {
  taskSchema,
  workloadPutSchema,
  workloadSaveSchema,
  plantStageSchema,
  gardenPostSchema,
} from "./schemas";

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
