"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import GardenGrid from "@/components/GardenGrid";
import type { GardenEntry } from "@/lib/types";

import {
  isGuestMode,
  getGuestGarden,
  deleteGuestGardenEntry,
  clearGuestGarden,
} from "@/lib/guestStorage";

export default function GardenPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [guestChecked, setGuestChecked] = useState(false);
  const [guest, setGuest] = useState(false);

  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Check for a local guest session once on mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    setGuest(isGuestMode());
    setGuestChecked(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !guestChecked) return;

    // Neither signed in nor a guest — this visitor should never have
    // reached this page directly. Send them to "/" where the Welcome
    // screen will correctly show instead of hitting the API and 401'ing.
    if (!isSignedIn && !guest) {
      router.push("/");
      return;
    }

    const guestActive = guest && !isSignedIn;

    async function loadGarden() {
      if (guestActive) {
        setEntries(getGuestGarden());
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/garden");

        if (!res.ok) {
          throw new Error("Failed to load garden");
        }

        const data = await res.json();
        setEntries(data);
      } catch (err) {
        console.error("Failed to load garden:", err);
        toast.error("Couldn't load your garden", {
          description: "Check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadGarden();
  }, [isLoaded, guestChecked, isSignedIn, guest, router]);

  const guestActive = guest && !isSignedIn;

  const handleDelete = async (id: string) => {
    if (guestActive) {
      deleteGuestGardenEntry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      return;
    }

    const previous = entries;
    setEntries((prev) => prev.filter((entry) => entry.id !== id));

    try {
      const res = await fetch(`/api/garden/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete entry");
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setEntries(previous);
      toast.error("Couldn't delete that plant", {
        description: "Please try again.",
      });
    }
  };

  const handleClearGarden = async () => {
    const confirmed = window.confirm(
      "Clear your entire garden? This cannot be undone."
    );

    if (!confirmed) return;

    if (guestActive) {
      clearGuestGarden();
      setEntries([]);
      return;
    }

    const previous = entries;
    setEntries([]);

    try {
      const res = await fetch("/api/garden", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to clear garden");
      }
    } catch (err) {
      console.error("Failed to clear garden:", err);
      setEntries(previous);
      toast.error("Couldn't clear your garden", {
        description: "Please try again.",
      });
    }
  };

  if (!isLoaded || !guestChecked || loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f8f5ef" }}
      >
        <p style={{ color: "#6b5a4a" }}>Loading garden...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#f8f5ef" }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-10 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1
            className="text-4xl font-bold"
            style={{
              color: "#2d1b0e",
              fontFamily: "'Lora', Georgia, serif",
            }}
          >
            🌿 Your Garden
          </h1>

          <p className="mt-3 max-w-2xl" style={{ color: "#6b5a4a" }}>
            Every plant here represents a completed workload. Keep growing your
            collection.
          </p>
        </motion.div>

        <GardenGrid entries={entries} onDelete={handleDelete} />

        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center mt-10"
          >
            <button
              onClick={handleClearGarden}
              className="px-5 py-3 rounded-xl font-medium transition hover:scale-105"
              style={{
                background: "#fff5f5",
                border: "1px solid #ffd6d6",
                color: "#c75c5c",
              }}
            >
              🗑 Clear Garden
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}
