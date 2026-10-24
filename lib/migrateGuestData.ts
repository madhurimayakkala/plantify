// lib/migrateGuestData.ts
import type { ActiveWorkload, GardenEntry } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MigrateGuestDataInput {
  garden: GardenEntry[];
  workload: ActiveWorkload | null;
  /** Injectable for tests. Defaults to the global fetch. */
  fetchFn?: FetchLike;
}

function assertOk(res: Response, what: string): void {
  if (!res.ok) {
    throw new Error(`${what} failed with status ${res.status}`);
  }
}

/**
 * Copies a guest's local garden entries and active workload into the
 * signed-in user's account.
 *
 * Resolves only if EVERY request succeeded. Throws on the first failure
 * (network error or non-2xx response), so callers must only clear local
 * guest data after this resolves.
 *
 * Safe to retry after a partial failure:
 * - Garden entries are sent with their client-generated id, and
 *   POST /api/garden is idempotent on that id, so re-sending an entry that
 *   already saved does not create a duplicate.
 * - The workload is only written if the account doesn't already have one,
 *   so a real, existing workload is never overwritten.
 */
export async function migrateGuestData({
  garden,
  workload,
  fetchFn = (input, init) => fetch(input, init),
}: MigrateGuestDataInput): Promise<void> {
  // Garden entries are additive, so they're always safe to migrate.
  for (const entry of garden) {
    const res = await fetchFn("/api/garden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    assertOk(res, `Saving garden entry ${entry.id}`);
  }

  // Only migrate the active workload if this account doesn't already have
  // one. If we can't tell (the check itself fails), we must NOT assume
  // "none" and risk overwriting real progress, so that throws too.
  if (workload) {
    const existingRes = await fetchFn("/api/workload");
    assertOk(existingRes, "Checking for an existing workload");
    const existing = await existingRes.json();

    if (!existing) {
      const putRes = await fetchFn("/api/workload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workload.name,
          tasks: workload.tasks,
          started_at: workload.startedAt,
          cumulative_water: workload.cumulativeWater,
        }),
      });
      assertOk(putRes, "Saving workload");
    }
  }
}
