"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import GardenGrid from "@/components/GardenGrid";
import type { GardenEntry } from "@/lib/types";

export default function GardenPage() {
  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGarden() {
      try {
        const res = await fetch("/api/garden");

        if (!res.ok) {
          throw new Error("Failed to load garden");
        }

      const data = await res.json();
      setEntries(data);

      } catch (err) {
        console.error("Failed to load garden:", err);
      } finally {
        setLoading(false);
      }
    }

    loadGarden();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/garden/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete entry");
      }

      setEntries((prev) =>
        prev.filter((entry) => entry.id !== id)
      );
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const handleClearGarden = async () => {
    const confirmed = window.confirm(
      "Clear your entire garden? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/garden", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to clear garden");
      }

      setEntries([]);
    } catch (err) {
      console.error("Failed to clear garden:", err);
    }
  };

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f8f5ef" }}
      >
        <p style={{ color: "#6b5a4a" }}>
          Loading garden...
        </p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{ background: "#f8f5ef" }}
    >
      <div className="max-w-7xl mx-auto">
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

          <p
            className="mt-3 max-w-2xl"
            style={{ color: "#6b5a4a" }}
          >
            Every plant here represents a completed workload.
            Keep growing your collection.
          </p>
        </motion.div>

        <GardenGrid
          entries={entries}
          onDelete={handleDelete}
        />

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