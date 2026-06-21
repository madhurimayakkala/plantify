import type { ActiveWorkload, GardenEntry } from "./types";

const ACTIVE_KEY = "plantify_active";
const GARDEN_KEY = "plantify_garden";

// ── Active Workload ──────────────────────────────────────────────────────────

export function getActive(): ActiveWorkload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveWorkload) : null;
  } catch {
    return null;
  }
}

export function setActive(workload: ActiveWorkload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(workload));
}

export function clearActive(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_KEY);
}

// ── Garden ───────────────────────────────────────────────────────────────────

export function getGarden(): GardenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    return raw ? (JSON.parse(raw) as GardenEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveToGarden(entry: GardenEntry): void {
  if (typeof window === "undefined") return;
  const garden = getGarden();
  garden.unshift(entry); // newest first
  localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
}

export function clearGarden(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GARDEN_KEY);
}

export function removeFromGarden(id: string): void {
  if (typeof window === "undefined") return;
  const garden = getGarden().filter((e) => e.id !== id);
  localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
}   