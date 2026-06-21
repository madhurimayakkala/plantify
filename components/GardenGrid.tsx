"use client";

import { motion } from "framer-motion";
import { Leaf } from "lucide-react";
import type { GardenEntry } from "@/lib/types";
import PlantCard from "./PlantCard";

interface Props {
  entries: GardenEntry[];
  onDelete: (id: string) => void;
}

export default function GardenGrid({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-20 px-6 rounded-2xl text-center"
        style={{ background: "#fefcf7", border: "1px solid #e8e0d5" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "#eaf5e9" }}
        >
          <Leaf size={28} style={{ color: "#7cb87a" }} />
        </div>
        <div>
          <h3
            className="font-bold text-lg"
            style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
          >
            Your garden is empty
          </h3>
          <p className="text-sm mt-1 max-w-xs" style={{ color: "#9b8878" }}>
            Complete a workload on the dashboard and save it here to start building your garden of progress.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-4 mb-6 flex-wrap"
      >
        {[
  {
    label: "Plants Saved",
    value: entries.length,
    color: "#3d6b35",
    bg: "#eaf5e9",
  },
  {
    label: "Avg Growth",
   value:
  entries.length > 0
    ? `${Math.round(
        entries.reduce(
          (s, e) => s + e.waterPercent,
          0
        ) / entries.length
      )}%`
    : "0%",
    color: "#a8d5e2",
    bg: "#eaf4f8",
  },
  {
    label: "Tasks Done",
    value: entries.reduce(
      (s, e) => s + e.tasksCompleted,
      0
    ),
    color: "#7cb87a",
    bg: "#f0f9ef",
  },
  {
    label: "Best Plant",
    value:
      [...entries].sort(
        (a, b) => b.waterPercent - a.waterPercent
      )[0]?.stageEmoji ?? "🌱",
    color: "#d9a441",
    bg: "#fff8e7",
  },
].map((stat) => (
          <div
            key={stat.label}
            className="px-5 py-3 rounded-xl flex flex-col"
            style={{ background: stat.bg, border: `1px solid ${stat.color}22` }}
          >
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
            <span className="text-xs" style={{ color: "#6b5a4a" }}>
              {stat.label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry, i) => (
          <PlantCard key={entry.id} entry={entry} index={i} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}