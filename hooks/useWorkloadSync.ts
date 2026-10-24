// hooks/useWorkloadSync.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { setGuestWorkload } from "@/lib/guestStorage";
import { toWorkloadPayload } from "@/lib/workloadMapping";
import type { ActiveWorkload } from "@/lib/types";

export const WORKLOAD_SAVE_DEBOUNCE_MS = 500;

/**
 * Owns the active workload and keeps it persisted (guest storage or the
 * server) with optimistic updates:
 *
 * - The UI updates immediately.
 * - Saves are sent to the server; rapid changes are debounced.
 * - If a server save fails, the UI rolls back to the last state known to be
 *   persisted and shows a retry toast.
 */
export function useWorkloadSync({
  usingGuestData,
}: {
  usingGuestData: boolean;
}) {
  const [workload, setWorkloadState] = useState<ActiveWorkload | null>(null);

  // Last state we know is actually persisted (server or guest storage).
  // Used to roll the UI back if a save fails.
  const lastSyncedRef = useRef<ActiveWorkload | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounced save if the component unmounts mid-type.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Show a workload that was just loaded from storage or the server. */
  function hydrate(loaded: ActiveWorkload | null) {
    setWorkloadState(loaded);
    lastSyncedRef.current = loaded;
  }

  /** Drop the workload locally (after it was deleted or archived). */
  function clearWorkload() {
    setWorkloadState(null);
    lastSyncedRef.current = null;
  }

  async function persistWorkload(
    updated: ActiveWorkload,
    { onFailRetry }: { onFailRetry: () => void }
  ) {
    if (usingGuestData) {
      setGuestWorkload(updated);
      lastSyncedRef.current = updated;
      return;
    }

    try {
      const res = await fetch("/api/workload", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toWorkloadPayload(updated)),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }

      lastSyncedRef.current = updated;
    } catch (error) {
      console.error("Failed to save workload:", error);

      // Roll the UI back to the last state we know actually saved,
      // so the user isn't looking at progress that silently didn't persist.
      setWorkloadState(lastSyncedRef.current);

      toast.error("Couldn't save your progress", {
        description: "Your last change wasn't saved. Try again?",
        action: {
          label: "Retry",
          onClick: onFailRetry,
        },
      });
    }
  }

  // Used for one-off, immediate saves (creating/continuing a workload) —
  // persists right away, no debounce.
  async function setWorkload(updated: ActiveWorkload) {
    setWorkloadState(updated);
    await persistWorkload(updated, {
      onFailRetry: () => setWorkload(updated),
    });
  }

  // Used by the task counter in WorkloadPanel, which can fire many times a
  // second. Updates the UI immediately (optimistic) but only sends one
  // network request after the user pauses, so rapid taps collapse into a
  // single write instead of racing each other.
  function updateWorkload(updated: ActiveWorkload) {
    setWorkloadState(updated);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      persistWorkload(updated, {
        onFailRetry: () => updateWorkload(updated),
      });
    }, WORKLOAD_SAVE_DEBOUNCE_MS);
  }

  return {
    workload,
    hydrate,
    clearWorkload,
    setWorkload,
    updateWorkload,
  };
}
