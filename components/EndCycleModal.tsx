"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Archive, RefreshCw, Sprout, X } from "lucide-react";
import type { ActiveWorkload, EndCycleChoice } from "@/lib/types";
import { calculateWater, getPlantInfo } from "@/lib/waterCalc";

interface Props {
  open: boolean;
  workload: ActiveWorkload | null;
  onClose: () => void;
  onChoose: (choice: EndCycleChoice) => void | Promise<void>;
}

interface OptionCard {
  choice: EndCycleChoice;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
  bg: string;
}

export default function EndCycleModal({ open, workload, onClose, onChoose }: Props) {
  const [processing, setProcessing] = useState(false);

  // Reset the processing state whenever the modal is (re)opened
  useEffect(() => {
    if (open) setProcessing(false);
  }, [open]);

  const water = workload ? calculateWater(workload.tasks, workload.cumulativeWater) : 0;
  const plant = getPlantInfo(water);

  const options: OptionCard[] = [
    {
      choice: "save_reset",
      icon: <Archive size={20} />,
      title: "Save & Reset",
      description:
        "Preserve this plant in your garden exactly as it is, then start fresh with a new seed.",
      accent: "#3d6b35",
      bg: "#eaf5e9",
    },
    {
      choice: "continue",
      icon: <Sprout size={20} />,
      title: "Continue",
      description:
        "Keep your plant and its current progress. Attach a new workload to keep growing.",
      accent: "#7cb87a",
      bg: "#f4faf2",
    },
    {
      choice: "reset",
      icon: <RefreshCw size={20} />,
      title: "Reset",
      description:
        "Discard this plant entirely. Nothing is saved. A new seed starts from zero.",
      accent: "#b34343",
      bg: "#fde8e8",
    },
  ];

  async function handleChoose(choice: EndCycleChoice) {
    if (processing) return;
    setProcessing(true);
    await onChoose(choice);
    // Don't reset `processing` here on purpose — the parent closes this
    // modal on success, and the `open` effect above resets state cleanly
    // the next time it's opened.
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={processing ? undefined : onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(45,27,14,0.4)", backdropFilter: "blur(4px)" }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "#fefcf7",
                boxShadow: "0 28px 70px rgba(45,27,14,0.2)",
                pointerEvents: "auto",
              }}
            >
              {/* Header */}
              <div
                className="px-6 pt-6 pb-5 border-b flex items-start justify-between"
                style={{ borderColor: "#e8e0d5" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-4xl"
                    style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}
                  >
                    {plant.emoji}
                  </span>
                  <div>
                    <h2
                      className="font-bold text-lg"
                      style={{
                        color: "#2d1b0e",
                        fontFamily: "'Lora', Georgia, serif",
                      }}
                    >
                      End Cycle
                    </h2>
                    <p className="text-sm" style={{ color: "#9b8878" }}>
                      {plant.label} · {water}% water
                      {workload && ` · ${workload.name}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={processing}
                  aria-label="Close"
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                  style={{ background: "#f0e8e0", color: "#5a3e2b" }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Options */}
              <div className="px-6 py-5 flex flex-col gap-3">
                {options.map((opt, i) => (
                  <motion.button
                    key={opt.choice}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={processing ? undefined : { scale: 1.015 }}
                    whileTap={processing ? undefined : { scale: 0.98 }}
                    onClick={() => handleChoose(opt.choice)}
                    disabled={processing}
                    className="w-full flex items-start gap-4 p-4 rounded-xl text-left transition-shadow disabled:opacity-50"
                    style={{
                      background: opt.bg,
                      border: `1.5px solid ${opt.accent}22`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${opt.accent}18`, color: opt.accent }}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: opt.accent }}
                      >
                        {opt.title}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6b5a4a" }}>
                        {opt.description}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="px-6 pb-5">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                  style={{ color: "#9b8878", background: "#f0e8e0" }}
                >
                  Keep working
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}