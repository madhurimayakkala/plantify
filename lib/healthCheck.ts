// lib/healthCheck.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Round-trips to Postgres through the Supabase API using the public
 * `health_check()` function (see supabase/migrations). The function reads no
 * table, so it works under RLS with no user logged in and exposes no data.
 * Only the boolean is returned; error details are deliberately not passed
 * on, because this endpoint is public.
 */
export async function checkDatabase(
  db: SupabaseClient
): Promise<{ ok: boolean }> {
  const { data, error } = await db.rpc("health_check");
  return { ok: !error && data === true };
}
