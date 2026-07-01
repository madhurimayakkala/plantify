"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, ArrowRight } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

interface Props {
  onGuest: () => void;
}

const STAGES = [
  { emoji: "🌰", label: "Seed" },
  { emoji: "🌱", label: "Sprout" },
  { emoji: "🌿", label: "Growing" },
  { emoji: "🌾", label: "Blooming" },
  { emoji: "🌳", label: "Full Tree" },
];

export default function WelcomeScreen({ onGuest }: Props) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const stage = STAGES[stageIndex];

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg,#fefcf7 0%,#f4faf2 100%)",
      }}
    >
      <div className="flex items-center gap-2.5 px-6 py-6 sm:px-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
          }}
        >
          <Leaf size={18} color="#fefcf7" strokeWidth={2.5} />
        </div>

        <span
          className="font-bold text-lg tracking-tight"
          style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
        >
          Plantify
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-md w-full flex flex-col items-center text-center gap-8">
          <div
            className="w-32 h-32 rounded-3xl flex items-center justify-center relative overflow-hidden"
            style={{ background: "#eaf5e9", border: "1px solid #d7ead6" }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={stage.label}
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, y: -8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-6xl"
              >
                {stage.emoji}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-3">
            <h1
              className="text-4xl font-bold leading-tight"
              style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
            >
              Turn your to-do list into something that grows.
            </h1>

            <p className="text-base leading-relaxed" style={{ color: "#6b5a4a" }}>
              Plantify waters a plant as you finish real work. Every task you
              complete moves it from seed to full tree.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <SignUpButton mode="modal">
              <button
                className="w-full px-5 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                style={{ background: "#3d6b35", color: "#ffffff" }}
              >
                Sign Up
                <ArrowRight size={16} />
              </button>
            </SignUpButton>

            <SignInButton mode="modal">
              <button
                className="w-full px-5 py-3.5 rounded-xl font-semibold text-sm transition hover:scale-[1.02]"
                style={{
                  background: "#f3f0ea",
                  color: "#3d6b35",
                  border: "1px solid #e8e0d5",
                }}
              >
                Sign In
              </button>
            </SignInButton>

            <button
              onClick={onGuest}
              className="w-full px-5 py-3 rounded-xl font-medium text-sm transition hover:scale-[1.02]"
              style={{ color: "#9b8878" }}
            >
              Continue as Guest
            </button>
          </div>

          <p className="text-xs" style={{ color: "#b3a494" }}>
            Guest mode saves your progress on this device only. Sign up
            anytime to keep it permanently.
          </p>
        </div>
      </div>
    </main>
  );
}