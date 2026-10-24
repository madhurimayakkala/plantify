// lib/workloadMapping.ts
import type { ActiveWorkload } from "./types";

/** The body the client sends to PUT /api/workload. */
export interface WorkloadPayload {
  name: string;
  tasks: ActiveWorkload["tasks"];
  started_at: string;
  cumulative_water: number;
}

/** A row as returned by GET /api/workload. */
export interface ServerWorkload {
  id?: string;
  name: string;
  tasks: ActiveWorkload["tasks"];
  started_at: string;
  cumulative_water: number;
}

export function toWorkloadPayload(workload: ActiveWorkload): WorkloadPayload {
  return {
    name: workload.name,
    tasks: workload.tasks,
    started_at: workload.startedAt,
    cumulative_water: workload.cumulativeWater,
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
