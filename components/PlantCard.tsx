"use client";

import { motion } from "framer-motion";
import { Calendar, Layers, Trash2 } from "lucide-react";
import type { GardenEntry } from "@/lib/types";

interface Props {
  entry: GardenEntry;
  index: number;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PlantCard({ entry, index, onDelete }: Props) {
  const waterPct = Math.round(entry.waterPercent);

  // Gradient per stage
  const gradients: Record<string, string> = {
    seed: "linear-gradient(160deg, #f5f0e8, #ede3d4)",
    sprout: "linear-gradient(160deg, #eef8ec, #ddf0d8)",
    growing: "linear-gradient(160deg, #e8f4e6, #d0eccc)",
    blooming: "linear-gradient(160deg, #fdf5e4, #f5e8c0)",
    tree: "linear-gradient(160deg, #e4f0df, #c6e0be)",
  };

  const borderColors: Record<string, string> = {
    seed: "#d4bfa0",
    sprout: "#7cb87a",
    growing: "#3d6b35",
    blooming: "#c4a047",
    tree: "#2d5a1f",
  };

  const bg = gradients[entry.stage] ?? gradients.growing;
  const borderColor = borderColors[entry.stage] ?? "#c8e6c0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.06,
        type: "spring",
        stiffness: 280,
        damping: 24,
      }}
      whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(61,107,53,0.14)" }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: bg,
        border: `1.5px solid ${borderColor}44`,
        boxShadow: "0 4px 18px rgba(45,27,14,0.07)",
      }}
    >
      {/* Plant emoji area */}
      <div className="flex flex-col items-center pt-6 pb-4 gap-2">
        <span
          style={{
            fontSize: "3.5rem",
            lineHeight: 1,
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.1))",
          }}
        >
          {entry.stageEmoji}
        </span>

        {/* Water bar */}
        <div className="w-3/4 mt-1">
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.08)" }}
          >
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: waterPct / 100 }}
              transition={{
                duration: 0.7,
                ease: "easeOut",
                delay: index * 0.06 + 0.2,
              }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #7cb87a, #3d6b35)`,
                transformOrigin: "left",
              }}
            />
          </div>
          <p
            className="text-center text-xs mt-1 font-semibold tabular-nums"
            style={{ color: borderColor }}
          >
            {waterPct}% water
          </p>
        </div>
      </div>

      {/* Info section */}
      <div
        className="px-4 py-4 flex flex-col gap-2 flex-1 border-t"
        style={{
          borderColor: `${borderColor}33`,
          background: "rgba(255,255,255,0.5)",
        }}
      >
        <p
          className="font-semibold text-sm leading-snug"
          style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
        >
          {entry.workloadName}
        </p>

        <div className="flex flex-col gap-1.5 mt-1">
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "#6b5a4a" }}
          >
            <Layers size={12} />
            <span>
              {entry.tasksCompleted} / {entry.tasksTotal} tasks done
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "#6b5a4a" }}
          >
            <Calendar size={12} />
            <span>{formatDate(entry.savedAt)}</span>
          </div>
        </div>
      </div>

      {/* Delete footer */}
      <div
        className="px-4 py-3 flex justify-end border-t"
        style={{
          borderColor: `${borderColor}22`,
          background: "rgba(255,255,255,0.3)",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onDelete(entry.id)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: "rgba(179,67,67,0.1)", color: "#b34343" }}
        >
          <Trash2 size={11} />
          Remove
        </motion.button>
      </div>
    </motion.div>
  );
}
