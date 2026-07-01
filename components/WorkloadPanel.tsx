"use client";

import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import type { ActiveWorkload, Task } from "@/lib/types";

interface Props {
  workload: ActiveWorkload;
  onUpdate: (updated: ActiveWorkload) => void;
}

export default function WorkloadPanel({
  workload,
  onUpdate,
}: Props) {
  function updateTask(taskId: string, delta: number) {
    const updated: ActiveWorkload = {
      ...workload,
      tasks: workload.tasks.map((t) => {
        if (t.id !== taskId) return t;

        const next = Math.max(
          0,
          Math.min(t.total, t.completed + delta)
        );

        return {
          ...t,
          completed: next,
        };
      }),
    };

    onUpdate(updated);
  }

  if (workload.tasks.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: "#fefcf7",
          border: "1px solid #e8e0d5",
        }}
      >
        <p
          className="text-sm"
          style={{ color: "#9b8878" }}
        >
          No tasks yet. Add a workload to start
          tracking progress.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#fefcf7",
        border: "1px solid #e8e0d5",
      }}
    >
      <div
        className="px-6 py-4 border-b"
        style={{
          borderColor: "#e8e0d5",
        }}
      >
        <h2
          className="font-semibold text-base"
          style={{
            color: "#2d1b0e",
            fontFamily: "'Lora', Georgia, serif",
          }}
        >
          {workload.name}
        </h2>

        <p
          className="text-xs mt-0.5"
          style={{ color: "#9b8878" }}
        >
          Track your progress below
        </p>
      </div>

      <div
        className="divide-y"
        style={{ borderColor: "#f0e8e0" }}
      >
        {workload.tasks.map(
          (task: Task, i: number) => {
            const pct =
              task.total > 0
                ? Math.round(
                    (task.completed /
                      task.total) *
                      100
                  )
                : 0;

            return (
              <motion.div
                key={task.id}
                initial={{
                  opacity: 0,
                  x: -8,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                transition={{
                  delay: i * 0.05,
                }}
                className="px-6 py-4 flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: "#2d1b0e",
                      }}
                    >
                      {task.name}
                    </p>

                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color: "#9b8878",
                      }}
                    >
                      {task.completed} /{" "}
                      {task.total} completed ·{" "}
                      {pct}%
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{
                        scale: 0.88,
                      }}
                      onClick={() =>
                        updateTask(
                          task.id,
                          -1
                        )
                      }
                      disabled={
                        task.completed === 0
                      }
                      aria-label={`Decrease ${task.name} progress`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                      style={{
                        background:
                          "#f0e8e0",
                        color: "#5a3e2b",
                      }}
                    >
                      <Minus
                        size={14}
                        strokeWidth={2.5}
                      />
                    </motion.button>

                    <span
                      className="w-8 text-center text-sm font-bold tabular-nums"
                      style={{
                        color: "#2d1b0e",
                      }}
                    >
                      {task.completed}
                    </span>

                    <motion.button
                      whileTap={{
                        scale: 0.88,
                      }}
                      onClick={() =>
                        updateTask(
                          task.id,
                          1
                        )
                      }
                      disabled={
                        task.completed ===
                        task.total
                      }
                      aria-label={`Increase ${task.name} progress`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                      style={{
                        background:
                          "#ddf0d8",
                        color: "#3d6b35",
                      }}
                    >
                      <Plus
                        size={14}
                        strokeWidth={2.5}
                      />
                    </motion.button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{
                    background:
                      "#e8e0d5",
                  }}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scaleX:
                        pct / 100,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                    style={{
                      transformOrigin:
                        "left",
                      background:
                        "linear-gradient(90deg, #7cb87a, #3d6b35)",
                      height: "100%",
                      borderRadius:
                        "999px",
                    }}
                  />
                </div>
              </motion.div>
            );
          }
        )}
      </div>
    </div>
  );
}