"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Sprout } from "lucide-react";
import type { ActiveWorkload } from "@/lib/types";
import { calculateWater, getPlantInfo, formatWaterBreakdown } from "@/lib/waterCalc";

interface Props {
  workload: ActiveWorkload | null;
  onEndCycle: () => void;
  onCreateWorkload: () => void;
}

export default function ActivePlant({ workload, onEndCycle, onCreateWorkload }: Props) {
  const water = workload
    ? calculateWater(workload.tasks, workload.cumulativeWater)
    : 0;
  const plant = getPlantInfo(water);
  const breakdown = workload ? formatWaterBreakdown(workload.tasks) : null;

  const hasWorkload = !!workload;
  const tasksTotal = workload?.tasks.reduce((s, t) => s + t.total, 0) ?? 0;
  const tasksDone = workload?.tasks.reduce((s, t) => s + t.completed, 0) ?? 0;

  return (
    <div
      className="rounded-2xl p-8 flex flex-col items-center gap-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #f4faf2 0%, #eaf5e4 60%, #d8f0d0 100%)",
        border: "1px solid #c8e6c0",
        boxShadow: "0 4px 32px rgba(61,107,53,0.08)",
      }}
    >
      {/* Decorative background rings */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 120%, rgba(124,184,122,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Plant emoji */}
      <AnimatePresence mode="wait">
        <motion.div
          key={plant.emoji}
          initial={{ scale: 0.7, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.7, opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="select-none"
          style={{ fontSize: "6rem", lineHeight: 1, filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.12))" }}
        >
          {plant.emoji}
        </motion.div>
      </AnimatePresence>

      {/* Stage badge */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ background: "#ddf0d8", color: "#3d6b35" }}
        >
          {plant.label}
        </span>
        {hasWorkload && (
          <p className="text-sm font-medium mt-1" style={{ color: "#4a6741" }}>
            {workload!.name}
          </p>
        )}
      </div>

      {/* Water bar */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#3d6b35" }}>
            <Droplets size={15} />
            Water
          </span>
          <motion.span
            key={water}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold tabular-nums"
            style={{ color: "#2d1b0e" }}
          >
            {water}%
          </motion.span>
        </div>
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: "#c8e6c0" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #7cb87a, #3d6b35)",
              transformOrigin: "left",
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: water / 100 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {breakdown && (
          <p className="text-xs text-center" style={{ color: "#6b8c5e" }}>
            {breakdown}
          </p>
        )}
      </div>

      {/* Task count */}
      {hasWorkload && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "#4a6741" }}>
          <Sprout size={14} />
          <span>
            {tasksDone} of {tasksTotal} items complete
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-1 flex-wrap justify-center">
        {!hasWorkload ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onCreateWorkload}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-shadow"
            style={{
              background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
              color: "#fefcf7",
              boxShadow: "0 4px 16px rgba(61,107,53,0.25)",
            }}
          >
            Plant a Seed
          </motion.button>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCreateWorkload}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
              style={{
                border: "1.5px solid #7cb87a",
                color: "#3d6b35",
                background: "#f4faf2",
              }}
            >
              Add Workload
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onEndCycle}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
                color: "#fefcf7",
                boxShadow: "0 4px 16px rgba(61,107,53,0.25)",
              }}
            >
              End Cycle
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}