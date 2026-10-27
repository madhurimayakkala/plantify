// lib/workloadSave.ts
//
// Server-side save for the active workload with optimistic concurrency.
// Kept out of the route file so it can be unit-tested with a fake client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerWorkload } from "./workloadMapping";

export interface SaveWorkloadInput {
  name: string;
  tasks: ServerWorkload["tasks"];
  started_at: string;
  cumulative_water: number;
  /** The updated_at the client last saw, or null for "no row yet". */
  expected_updated_at: string | null;
}

export type WorkloadRow = ServerWorkload & { user_id?: string };

export type SaveWorkloadResult =
  | { status: "ok"; workload: WorkloadRow }
  | { status: "conflict"; current: WorkloadRow | null }
  | { status: "error"; message: string };

const TABLE = "active_workloads";
// Postgres unique_violation: the row already exists.
const UNIQUE_VIOLATION = "23505";

/**
 * Compare-and-swap on `updated_at`:
 *
 * - expected_updated_at === null  -> INSERT. If the user already has a row
 *   (e.g. created in another tab) the unique constraint rejects it and we
 *   report a conflict instead of overwriting.
 * - expected_updated_at === "..." -> UPDATE ... WHERE user_id = ? AND
 *   updated_at = ?. Zero rows updated means someone else wrote (or deleted)
 *   in between: conflict, with the current row (or null if it was deleted).
 *
 * The server stamps updated_at itself; clients never choose it.
 */
export async function saveWorkload(
  db: SupabaseClient,
  userId: string,
  input: SaveWorkloadInput
): Promise<SaveWorkloadResult> {
  const { expected_updated_at: expected, ...content } = input;
  const fields = { ...content, updated_at: new Date().toISOString() };

  async function loadCurrent(): Promise<SaveWorkloadResult> {
    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { status: "error", message: error.message };
    return {
      status: "conflict",
      current: (data as WorkloadRow | null) ?? null,
    };
  }

  if (expected === null) {
    const { data, error } = await db
      .from(TABLE)
      .insert({ user_id: userId, ...fields })
      .select()
      .single();

    if (!error) return { status: "ok", workload: data as WorkloadRow };
    if (error.code === UNIQUE_VIOLATION) return loadCurrent();
    return { status: "error", message: error.message };
  }

  const { data, error } = await db
    .from(TABLE)
    .update(fields)
    .eq("user_id", userId)
    .eq("updated_at", expected)
    .select();

  if (error) return { status: "error", message: error.message };
  if (data && data.length > 0) {
    return { status: "ok", workload: data[0] as WorkloadRow };
  }
  return loadCurrent();
}
