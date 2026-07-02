import type { ActiveWorkload, GardenEntry } from "./types";

const GUEST_MODE_KEY = "plantify_guest_mode";
const GUEST_WORKLOAD_KEY = "plantify_guest_workload";
const GUEST_GARDEN_KEY = "plantify_guest_garden";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function isGuestMode(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
}

export function enableGuestMode(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GUEST_MODE_KEY, "true");
}

export function exitGuestMode(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(GUEST_MODE_KEY);
  window.localStorage.removeItem(GUEST_WORKLOAD_KEY);
  window.localStorage.removeItem(GUEST_GARDEN_KEY);
}

export function getGuestWorkload(): ActiveWorkload | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(GUEST_WORKLOAD_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActiveWorkload;
  } catch {
    return null;
  }
}

export function setGuestWorkload(workload: ActiveWorkload): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GUEST_WORKLOAD_KEY, JSON.stringify(workload));
}

export function deleteGuestWorkload(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(GUEST_WORKLOAD_KEY);
}

export function getGuestGarden(): GardenEntry[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(GUEST_GARDEN_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as GardenEntry[];
  } catch {
    return [];
  }
}

export function addGuestGardenEntry(entry: GardenEntry): void {
  if (!isBrowser()) return;

  const entries = getGuestGarden();
  entries.unshift(entry);
  window.localStorage.setItem(GUEST_GARDEN_KEY, JSON.stringify(entries));
}

export function deleteGuestGardenEntry(id: string): void {
  if (!isBrowser()) return;

  const entries = getGuestGarden().filter((entry) => entry.id !== id);
  window.localStorage.setItem(GUEST_GARDEN_KEY, JSON.stringify(entries));
}

export function clearGuestGarden(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GUEST_GARDEN_KEY, JSON.stringify([]));
}
