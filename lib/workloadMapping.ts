// lib/workloadMapping.ts
import type { ActiveWorkload } from "./types";

/** The body the client sends to PUT /api/workload. */
export interface WorkloadPayload {
  name: string;
  tasks: ActiveWorkload["tasks"];
  started_at: string;
  cumulative_water: number;
  /**
   * The `updated_at` this client last saw, or null if it thinks no row
   * exists yet. The server only applies the write if it still matches.
   */
  expected_updated_at: string | null;
}

/** A row as returned by GET /api/workload. */
export interface ServerWorkload {
  id?: string;
  name: string;
  tasks: ActiveWorkload["tasks"];
  started_at: string;
  cumulative_water: number;
  /** Server-assigned version stamp; changes on every successful write. */
  updated_at?: string;
}

export function toWorkloadPayload(
  workload: ActiveWorkload,
  expectedUpdatedAt: string | null
): WorkloadPayload {
  return {
    name: workload.name,
    tasks: workload.tasks,
    started_at: workload.startedAt,
    cumulative_water: workload.cumulativeWater,
    expected_updated_at: expectedUpdatedAt,
  };
}

export function fromServerWorkload(row: ServerWorkload): ActiveWorkload {
  return {
    id: row.id ?? crypto.randomUUID(),
    name: row.name,
    tasks: row.tasks,
    startedAt: row.started_at,
    cumulativeWater: row.cumulative_water,
  };
}
