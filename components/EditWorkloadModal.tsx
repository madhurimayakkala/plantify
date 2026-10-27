"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { ActiveWorkload } from "@/lib/types";
import {
  applyEdits,
  hasChanges,
  moveItem,
  newDraftTask,
  previewClamps,
  toDraft,
  type DraftTask,
} from "@/lib/workloadEdit";

interface Props {
  open: boolean;
  workload: ActiveWorkload | null;
  onClose: () => void;
  /** Called with the validated workload. The parent saves it optimistically. */
  onSave: (workload: ActiveWorkload) => void | Promise<void>;
}

const inputStyle = {
  background: "#f4faf2",
  border: "1.5px solid #c8e6c0",
  color: "#2d1b0e",
} as const;

const iconButtonStyle = {
  background: "#f0e8e0",
  color: "#5a3e2b",
} as const;

export default function EditWorkloadModal({
  open,
  workload,
  onClose,
  onSave,
}: Props) {
  return (
    <AnimatePresence>
      {open && workload && (
        // The form mounts fresh each time the modal opens, so its draft
        // always starts from the current workload.
        <EditForm workload={workload} onClose={onClose} onSave={onSave} />
      )}
    </AnimatePresence>
  );
}

function EditForm({
  workload,
  onClose,
  onSave,
}: {
  workload: ActiveWorkload;
  onClose: () => void;
  onSave: (workload: ActiveWorkload) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => toDraft(workload));
  const [errors, setErrors] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // After a keyboard move, put focus back on the same kind of button so the
  // user can keep pressing it, even though the row moved.
  const pendingFocus = useRef<{ id: string; dir: "up" | "down" } | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  const clamps = previewClamps(draft.tasks);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;

    const index = draft.tasks.findIndex((t) => t.id === pending.id);
    const preferred =
      pending.dir === "up" && index > 0
        ? "up"
        : pending.dir === "down" && index < draft.tasks.length - 1
          ? "down"
          : pending.dir === "up"
            ? "down"
            : "up";

    buttonRefs.current.get(`${pending.id}:${preferred}`)?.focus();
  }, [draft.tasks]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function updateTask(id: string, field: "name" | "total", value: string) {
    setDraft((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));
  }

  function addTask() {
    setDraft((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newDraftTask(crypto.randomUUID())],
    }));
  }

  function removeTask(id: string) {
    setDraft((prev) =>
      prev.tasks.length > 1
        ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }
        : prev
    );
  }

  function moveTask(from: number, to: number, viaKeyboard?: "up" | "down") {
    const task = draft.tasks[from];
    if (!task || from === to) return;

    if (viaKeyboard) pendingFocus.current = { id: task.id, dir: viaKeyboard };

    setDraft((prev) => ({ ...prev, tasks: moveItem(prev.tasks, from, to) }));

    setAnnouncement(
      `${task.name.trim() || `Task ${from + 1}`} moved to position ${
        to + 1
      } of ${draft.tasks.length}`
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = applyEdits(workload, draft);

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors([]);

    if (!hasChanges(workload, draft)) {
      onClose();
      return;
    }

    if (result.clamped.length > 0) {
      toast.message("Progress lowered to fit the new total", {
        description: result.clamped
          .map((c) => `${c.name}: ${c.from} to ${c.to}`)
          .join(" · "),
      });
    }

    void onSave(result.workload);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(45,27,14,0.35)",
          backdropFilter: "blur(3px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <form
          onSubmit={handleSubmit}
          noValidate
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-workload-title"
          className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
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
                id="edit-workload-title"
                className="font-bold text-lg"
                style={{
                  color: "#2d1b0e",
                  fontFamily: "'Lora', Georgia, serif",
                }}
              >
                Edit Workload
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#9b8878" }}>
                Rename it, change tasks, or reorder them. Progress is kept.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={iconButtonStyle}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-workload-name"
                className="text-sm font-semibold"
                style={{ color: "#2d1b0e" }}
              >
                Workload Name
              </label>
              <input
                id="edit-workload-name"
                type="text"
                value={draft.name}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: "#2d1b0e" }}
              >
                Tasks
              </span>

              <ul className="flex flex-col gap-2" aria-label="Tasks">
                {draft.tasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={i}
                    count={draft.tasks.length}
                    clampedTo={clamps.get(task.id)}
                    isDragging={dragIndex === i}
                    isDropTarget={
                      overIndex === i && dragIndex !== null && dragIndex !== i
                    }
                    registerButton={(key, el) => {
                      if (el) buttonRefs.current.set(key, el);
                      else buttonRefs.current.delete(key);
                    }}
                    onChange={updateTask}
                    onRemove={removeTask}
                    onMove={moveTask}
                    onDragStart={() => setDragIndex(i)}
                    onDragEnter={() => setOverIndex(i)}
                    onDrop={() => {
                      if (dragIndex !== null) moveTask(dragIndex, i);
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    canDrag={dragIndex !== null}
                  />
                ))}
              </ul>

              <button
                type="button"
                onClick={addTask}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl mt-1 self-start"
                style={{ color: "#3d6b35", background: "#eaf5e9" }}
              >
                <Plus size={14} />
                Add task
              </button>
            </div>

            {errors.length > 0 && (
              <div
                role="alert"
                className="text-xs px-3 py-2 rounded-lg flex flex-col gap-1"
                style={{ background: "#fde8e8", color: "#b34343" }}
              >
                {errors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}

            {/* Screen reader announcements for reordering */}
            <p className="sr-only" role="status" aria-live="polite">
              {announcement}
            </p>
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 flex gap-3 border-t"
            style={{ borderColor: "#e8e0d5" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ border: "1.5px solid #e8e0d5", color: "#5a3e2b" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "linear-gradient(135deg, #7cb87a, #3d6b35)",
                color: "#fefcf7",
                boxShadow: "0 4px 14px rgba(61,107,53,0.28)",
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

interface TaskRowProps {
  task: DraftTask;
  index: number;
  count: number;
  clampedTo: number | undefined;
  isDragging: boolean;
  isDropTarget: boolean;
  canDrag: boolean;
  registerButton: (key: string, el: HTMLButtonElement | null) => void;
  onChange: (id: string, field: "name" | "total", value: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number, viaKeyboard?: "up" | "down") => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function TaskRow({
  task,
  index,
  count,
  clampedTo,
  isDragging,
  isDropTarget,
  canDrag,
  registerButton,
  onChange,
  onRemove,
  onMove,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: TaskRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const displayName = task.name.trim() || `task ${index + 1}`;

  return (
    <li
      ref={rowRef}
      // The row is a drop target; only the grip handle is draggable, so text
      // selection inside the inputs keeps working.
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={onDragEnter}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className="rounded-xl p-2 flex flex-col gap-1"
      style={{
        opacity: isDragging ? 0.45 : 1,
        outline: isDropTarget ? "2px dashed #7cb87a" : "none",
        background: isDropTarget ? "#f4faf2" : "transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", task.id);
            if (rowRef.current)
              e.dataTransfer.setDragImage(rowRef.current, 12, 12);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-hidden="true"
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing flex-shrink-0 px-0.5 py-2"
          style={{ color: "#9b8878" }}
        >
          <GripVertical size={16} />
        </span>

        <div className="flex flex-col flex-shrink-0">
          <button
            type="button"
            ref={(el) => registerButton(`${task.id}:up`, el)}
            onClick={() => onMove(index, index - 1, "up")}
            disabled={index === 0}
            aria-label={`Move ${displayName} up`}
            className="w-6 h-5 rounded-md flex items-center justify-center disabled:opacity-30"
            style={iconButtonStyle}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            ref={(el) => registerButton(`${task.id}:down`, el)}
            onClick={() => onMove(index, index + 1, "down")}
            disabled={index === count - 1}
            aria-label={`Move ${displayName} down`}
            className="w-6 h-5 mt-0.5 rounded-md flex items-center justify-center disabled:opacity-30"
            style={iconButtonStyle}
          >
            <ChevronDown size={13} />
          </button>
        </div>

        <input
          type="text"
          value={task.name}
          onChange={(e) => onChange(task.id, "name", e.target.value)}
          placeholder={`Task ${index + 1} name`}
          aria-label={`Task ${index + 1} name`}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
        <input
          type="number"
          value={task.total}
          onChange={(e) => onChange(task.id, "total", e.target.value)}
          placeholder="Total"
          min={1}
          aria-label={`Task ${index + 1} total`}
          className="w-20 px-3 py-2 rounded-xl text-sm outline-none text-center"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          disabled={count === 1}
          aria-label={`Remove ${displayName}`}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30"
          style={{ background: "#fde8e8", color: "#b34343" }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {(task.completed > 0 || clampedTo !== undefined) && (
        <p
          className="text-xs pl-[3.75rem]"
          style={{ color: clampedTo !== undefined ? "#9b6b1f" : "#9b8878" }}
        >
          {clampedTo !== undefined
            ? `${task.completed} done now. Saving will lower it to ${clampedTo}.`
            : `${task.completed} done so far`}
        </p>
      )}
    </li>
  );
}
