// hooks/useWorkloadSync.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { setGuestWorkload } from "@/lib/guestStorage";
import {
  fromServerWorkload,
  toWorkloadPayload,
  type ServerWorkload,
} from "@/lib/workloadMapping";
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
 * - Server saves are optimistic-concurrency checked: each PUT carries the
 *   `updated_at` we last saw. If the server answers 409 (another tab or
 *   device changed the workload first) we show a toast and swap in the
 *   server's current copy instead of overwriting it.
 * - Saves are sent one at a time, so each one can carry the stamp returned
 *   by the previous one (otherwise our own quick successive saves would
 *   conflict with each other).
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

  // The server's `updated_at` for our copy; null means "no row yet". A ref,
  // not state, because a save reads it at send time, not render time.
  const serverStampRef = useRef<string | null>(null);

  // Tail of the save queue, and a counter bumped on every conflict so saves
  // that were queued against stale data can be dropped instead of sent.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);

  // Clear any pending debounced save if the component unmounts mid-type.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Show a workload that was just loaded from storage or the server. */
  function hydrate(
    loaded: ActiveWorkload | null,
    serverUpdatedAt: string | null = null
  ) {
    setWorkloadState(loaded);
    lastSyncedRef.current = loaded;
    serverStampRef.current = serverUpdatedAt;
  }

  /** Drop the workload locally (after it was deleted or archived). */
  function clearWorkload() {
    setWorkloadState(null);
    lastSyncedRef.current = null;
    serverStampRef.current = null;
  }

  /**
   * The server said our copy is stale. Drop anything still waiting to be
   * sent (it was built on old data), show what the server has, and tell the
   * user. The page stays where it is; only the workload data is replaced.
   */
  function handleConflict(current: ServerWorkload | null | undefined) {
    generationRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (current) {
      const fresh = fromServerWorkload(current);
      setWorkloadState(fresh);
      lastSyncedRef.current = fresh;
      serverStampRef.current = current.updated_at ?? null;
      toast.warning("Your workload was updated elsewhere", {
        description:
          "We loaded the latest version. Your last change wasn't applied.",
      });
    } else {
      setWorkloadState(null);
      lastSyncedRef.current = null;
      serverStampRef.current = null;
      toast.warning("This workload was removed elsewhere", {
        description: "Your last change wasn't applied.",
      });
    }
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

    // Queue behind any save already in flight, and skip if a conflict
    // happened since this save was requested (its data is now stale).
    const generation = generationRef.current;

    const run = async () => {
      if (generation !== generationRef.current) return;

      try {
        const res = await fetch("/api/workload", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            toWorkloadPayload(updated, serverStampRef.current)
          ),
        });

        if (res.status === 409) {
          const body = await res.json().catch(() => null);
          handleConflict(body?.current);
          return;
        }

        if (!res.ok) {
          throw new Error("Save failed");
        }

        // Remember the new stamp so our next save passes the check.
        const saved = await res.json().catch(() => null);
        if (typeof saved?.updated_at === "string") {
          serverStampRef.current = saved.updated_at;
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
    };

    const next = queueRef.current.then(run);
    queueRef.current = next;
    await next;
  }

  // Used for one-off, immediate saves (creating/continuing a workload) —
  // persists right away, no debounce.
  async function setWorkload(updated: ActiveWorkload) {
    // This state is built from the latest UI state, so it supersedes any
    // debounced save still waiting (which would otherwise fire afterwards
    // with an older snapshot and overwrite this change).
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

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
