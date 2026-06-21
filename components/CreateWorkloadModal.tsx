"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import type { ActiveWorkload, Task } from "@/lib/types";

interface DraftTask {
  id: string;
  name: string;
  total: string;
}

interface Props {
  open: boolean;
  existingWorkload: ActiveWorkload | null;
  onClose: () => void;
  onSave: (workload: ActiveWorkload) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyTask(): DraftTask {
  return { id: uid(), name: "", total: "" };
}

export default function CreateWorkloadModal({ open, existingWorkload, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask()]);
  const [error, setError] = useState("");

  // Reset form when modal opens
  const handleOpen = useCallback(() => {
    setName("");
    setTasks([emptyTask()]);
    setError("");
  }, []);

  // Called when AnimatePresence triggers entry
  function addTask() {
    setTasks((prev) => [...prev, emptyTask()]);
  }

  function removeTask(id: string) {
    setTasks((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev));
  }

  function updateTask(id: string, field: "name" | "total", value: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("Workload name is required.");
      return;
    }

    const validTasks: Task[] = [];
    for (const t of tasks) {
      if (!t.name.trim()) {
        setError("All tasks need a name.");
        return;
      }
      const total = parseInt(t.total, 10);
      if (isNaN(total) || total < 1) {
        setError(`"${t.name}" must have a total of at least 1.`);
        return;
      }
      validTasks.push({ id: t.id, name: t.name.trim(), total, completed: 0 });
    }

    setError("");

    const workload: ActiveWorkload = {
      id: existingWorkload?.id ?? uid(),
      name: name.trim(),
      tasks: existingWorkload
        ? [...existingWorkload.tasks, ...validTasks]
        : validTasks,
      startedAt: existingWorkload?.startedAt ?? new Date().toISOString(),
      cumulativeWater: existingWorkload?.cumulativeWater ?? 0,
    };

    onSave(workload);
    setName("");
    setTasks([emptyTask()]);
  }

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(45,27,14,0.35)", backdropFilter: "blur(3px)" }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: "#fefcf7",
                boxShadow: "0 24px 60px rgba(45,27,14,0.18)",
                maxHeight: "90vh",
                pointerEvents: "auto",
              }}
            >
              {/* Header */}
              <div
                className="px-6 py-5 flex items-center justify-between border-b"
                style={{ borderColor: "#e8e0d5" }}
              >
                <div>
                  <h2
                    className="font-bold text-lg"
                    style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
                  >
                    {existingWorkload ? "Add to Workload" : "New Workload"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#9b8878" }}>
                    {existingWorkload
                      ? "New tasks will be added to your active plant."
                      : "Define what you're working on and break it into tasks."}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "#f0e8e0", color: "#5a3e2b" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                {/* Workload name */}
                {!existingWorkload && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-sm font-semibold"
                      style={{ color: "#2d1b0e" }}
                    >
                      Workload Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. DSA Midterm Prep"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-shadow"
                      style={{
                        background: "#f4faf2",
                        border: "1.5px solid #c8e6c0",
                        color: "#2d1b0e",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#7cb87a")}
                      onBlur={(e) => (e.target.style.borderColor = "#c8e6c0")}
                    />
                  </div>
                )}

                {/* Tasks */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold" style={{ color: "#2d1b0e" }}>
                    Tasks
                  </label>

                  <AnimatePresence initial={false}>
                    {tasks.map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={task.name}
                            onChange={(e) => updateTask(task.id, "name", e.target.value)}
                            placeholder={`Task ${i + 1} name`}
                            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                            style={{
                              background: "#f4faf2",
                              border: "1.5px solid #c8e6c0",
                              color: "#2d1b0e",
                            }}
                          />
                          <input
                            type="number"
                            value={task.total}
                            onChange={(e) => updateTask(task.id, "total", e.target.value)}
                            placeholder="Total"
                            min={1}
                            className="w-20 px-3 py-2 rounded-xl text-sm outline-none text-center"
                            style={{
                              background: "#f4faf2",
                              border: "1.5px solid #c8e6c0",
                              color: "#2d1b0e",
                            }}
                          />
                          <button
                            onClick={() => removeTask(task.id)}
                            disabled={tasks.length === 1}
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30"
                            style={{ background: "#fde8e8", color: "#b34343" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button
                    onClick={addTask}
                    className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl mt-1 transition-colors self-start"
                    style={{ color: "#3d6b35", background: "#eaf5e9" }}
                  >
                    <Plus size={14} />
                    Add task
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: "#fde8e8", color: "#b34343" }}
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-6 py-4 flex gap-3 border-t"
                style={{ borderColor: "#e8e0d5" }}
              >
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                  style={{ border: "1.5px solid #e8e0d5", color: "#5a3e2b" }}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
                    color: "#fefcf7",
                    boxShadow: "0 4px 14px rgba(61,107,53,0.28)",
                  }}
                >
                  {existingWorkload ? "Add Tasks" : "Plant Seed"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}