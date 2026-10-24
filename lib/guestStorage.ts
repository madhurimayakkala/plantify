import type { ActiveWorkload, GardenEntry } from "./types";

const GUEST_MODE_KEY = "plantify_guest_mode";
const GUEST_WORKLOAD_KEY = "plantify_guest_workload";
const GUEST_GARDEN_KEY = "plantify_guest_garden";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Lets React components subscribe to the guest flag (via
// useSyncExternalStore) instead of copying it into state inside an effect.
const guestModeListeners = new Set<() => void>();

function emitGuestModeChange(): void {
  guestModeListeners.forEach((listener) => listener());
}

export function subscribeGuestMode(listener: () => void): () => void {
  guestModeListeners.add(listener);
  // The "storage" event covers changes made from another tab.
  if (isBrowser()) window.addEventListener("storage", listener);

  return () => {
    guestModeListeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", listener);
  };
}

export function isGuestMode(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
}

export function enableGuestMode(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GUEST_MODE_KEY, "true");
  emitGuestModeChange();
}

export function exitGuestMode(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(GUEST_MODE_KEY);
  window.localStorage.removeItem(GUEST_WORKLOAD_KEY);
  window.localStorage.removeItem(GUEST_GARDEN_KEY);
  emitGuestModeChange();
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
