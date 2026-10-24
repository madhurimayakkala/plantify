// hooks/useWorkload.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import { migrateGuestData } from "@/lib/migrateGuestData";
import { fromServerWorkload } from "@/lib/workloadMapping";
import {
  exitGuestMode,
  getGuestWorkload,
  getGuestGarden,
} from "@/lib/guestStorage";

import type { ActiveWorkload } from "@/lib/types";

import { useGuestMode } from "./useGuestMode";
import { useWorkloadSync } from "./useWorkloadSync";
import { useEndCycle } from "./useEndCycle";

/**
 * Composes the pieces behind the dashboard:
 * - useGuestMode: is this a guest session?
 * - useWorkloadSync: the workload itself, with optimistic saves + rollback
 * - useEndCycle: save & reset / continue / reset
 * - migrateGuestData: copying guest data into a new account
 */
export function useWorkload() {
  const { isLoaded, isSignedIn } = useUser();

  const { guestChecked, guest, continueAsGuest, markMigrationHandled } =
    useGuestMode();

  const [createOpen, setCreateOpen] = useState(false);

  const [endCycleOpen, setEndCycleOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const usingGuestData = guest && !isSignedIn;

  const { workload, hydrate, clearWorkload, setWorkload, updateWorkload } =
    useWorkloadSync({ usingGuestData });

  const { handleEndChoice } = useEndCycle({
    workload,
    usingGuestData,
    setWorkload,
    clearWorkload,
    closeEndCycle: () => setEndCycleOpen(false),
    openCreate: () => setCreateOpen(true),
  });

  // Ensures we only ever attempt guest -> account migration once per
  // mounted session, even if this effect re-runs for other reasons.
  const migrationAttemptedRef = useRef(false);

  /**
   * Copies a guest's local workload + garden entries into their new
   * Supabase account. Called once, at the exact moment a guest becomes
   * signed in.
   *
   * Safety rule: we never overwrite an existing real workload on the
   * server. Garden entries are always safe to add (they never replace
   * existing ones), so those always migrate.
   */
  async function migrateGuestDataToAccount() {
    const localWorkload = getGuestWorkload();
    const localGarden = getGuestGarden();

    const hasDataToMigrate = localWorkload !== null || localGarden.length > 0;

    if (!hasDataToMigrate) {
      exitGuestMode();
      return;
    }

    try {
      // Throws if any request fails, so we only fall through to
      // exitGuestMode() and the success toast when everything saved.
      await migrateGuestData({ garden: localGarden, workload: localWorkload });

      exitGuestMode();

      toast.success("Your guest progress has been saved!", {
        description:
          "We moved your active workload and garden into your new account.",
      });
    } catch (error) {
      console.error("Failed to migrate guest data:", error);

      // On failure, we deliberately do NOT clear local guest storage —
      // the data stays safely on this device, and since we don't clear
      // the guest flag either, a page refresh will naturally retry the
      // migration next time this hook runs.
      toast.error("We couldn't save all of your guest progress", {
        description:
          "Your data is still on this device. Try refreshing the page.",
      });
    }
  }

  useEffect(() => {
    if (!isLoaded || !guestChecked) return;
    if (!isSignedIn && !guest) return; // nothing to load yet, still on the welcome screen

    async function run() {
      // If this is a guest who just signed in, migrate their local
      // data into their new account first, then let the normal load
      // path (below, in a future run of this effect) take over.
      if (isSignedIn && guest && !migrationAttemptedRef.current) {
        migrationAttemptedRef.current = true;
        await migrateGuestDataToAccount();
        markMigrationHandled(); // triggers this effect to re-run with fresh, correct state
        return;
      }

      if (usingGuestData) {
        const active = getGuestWorkload();

        if (active) {
          hydrate(active);
        } else {
          setCreateOpen(true);
        }

        return;
      }

      try {
        const res = await fetch("/api/workload");

        if (!res.ok) {
          setCreateOpen(true);
          return;
        }

        const active = await res.json();

        if (active) {
          hydrate(fromServerWorkload(active));
        } else {
          setCreateOpen(true);
        }
      } catch (error) {
        console.error("Failed to load workload:", error);
        toast.error("Couldn't load your workload", {
          description: "Check your connection and refresh the page.",
        });
        setCreateOpen(true);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, guestChecked, isSignedIn, guest]);

  async function saveWorkload(workloadData: ActiveWorkload) {
    await setWorkload(workloadData);
    setCreateOpen(false);
  }

  // Edits apply optimistically: the modal closes right away and, if the
  // save fails, useWorkloadSync rolls the UI back and offers a retry.
  async function saveEditedWorkload(edited: ActiveWorkload) {
    setEditOpen(false);
    await setWorkload(edited);
  }

  return {
    // Auth / guest state — needed to decide what to render
    isLoaded,
    isSignedIn,
    guestChecked,
    guest,

    // Workload data
    workload,

    // Modal open/close state
    createOpen,
    setCreateOpen,
    endCycleOpen,
    setEndCycleOpen,
    editOpen,
    setEditOpen,

    // Actions
    updateWorkload,
    saveWorkload,
    saveEditedWorkload,
    handleEndChoice,
    handleContinueAsGuest: continueAsGuest,
  };
}
