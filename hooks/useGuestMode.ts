// hooks/useGuestMode.ts
"use client";

import { useState, useSyncExternalStore } from "react";

import {
  isGuestMode,
  enableGuestMode,
  subscribeGuestMode,
} from "@/lib/guestStorage";

const noopSubscribe = () => () => {};

/**
 * False during server rendering and the hydration pass, true afterwards.
 * Replaces the old "setChecked(true) in an effect" pattern, and keeps
 * client-only values (like localStorage) from causing hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Live view of the guest flag in localStorage. Always false on the server. */
export function useIsGuestMode(): boolean {
  return useSyncExternalStore(subscribeGuestMode, isGuestMode, () => false);
}

/**
 * Guest-session state for the dashboard.
 *
 * `guest` is the stored guest flag, except once a guest -> account
 * migration has been attempted: from then on this session no longer treats
 * the user as a guest (even if the migration failed and the flag was kept
 * in storage so a refresh can retry).
 */
export function useGuestMode() {
  const guestChecked = useHydrated();
  const storedGuest = useIsGuestMode();
  const [migrationHandled, setMigrationHandled] = useState(false);

  const guest = storedGuest && !migrationHandled;

  function continueAsGuest() {
    enableGuestMode();
    setMigrationHandled(false);
  }

  function markMigrationHandled() {
    setMigrationHandled(true);
  }

  return { guestChecked, guest, continueAsGuest, markMigrationHandled };
}
