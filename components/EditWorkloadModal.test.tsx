// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

import { toast } from "sonner";
import EditWorkloadModal from "./EditWorkloadModal";
import type { ActiveWorkload } from "@/lib/types";

const workload: ActiveWorkload = {
  id: "w1",
  name: "Finals",
  tasks: [
    { id: "a", name: "Read", total: 10, completed: 8 },
    { id: "b", name: "Practice", total: 4, completed: 1 },
    { id: "c", name: "Review", total: 6, completed: 0 },
  ],
  startedAt: "2026-01-01T00:00:00.000Z",
  cumulativeWater: 0,
};

function setup() {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <EditWorkloadModal
      open
      workload={workload}
      onSave={onSave}
      onClose={onClose}
    />
  );
  return { onSave, onClose };
}

function taskNames(): string[] {
  return screen
    .getAllByLabelText(/^Task \d+ name$/)
    .map((el) => (el as HTMLInputElement).value);
}

afterEach(() => {
  cleanup();
  vi.mocked(toast.message).mockClear();
});

describe("EditWorkloadModal", () => {
  it("starts from the current workload", () => {
    setup();

    expect(screen.getByLabelText("Workload Name")).toHaveProperty(
      "value",
      "Finals"
    );
    expect(taskNames()).toEqual(["Read", "Practice", "Review"]);
  });

  it("reorders with the move buttons and saves the new order", () => {
    const { onSave, onClose } = setup();

    fireEvent.click(screen.getByLabelText("Move Review up"));
    expect(taskNames()).toEqual(["Read", "Review", "Practice"]);

    fireEvent.click(screen.getByLabelText("Move Read down"));
    expect(taskNames()).toEqual(["Review", "Read", "Practice"]);

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      onSave.mock.calls[0][0].tasks.map((t: { id: string }) => t.id)
    ).toEqual(["c", "a", "b"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("disables moving the first task up and the last task down", () => {
    setup();

    expect(screen.getByLabelText("Move Read up")).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByLabelText("Move Review down")).toHaveProperty(
      "disabled",
      true
    );
  });

  it("renames the workload and tasks", () => {
    const { onSave } = setup();

    fireEvent.change(screen.getByLabelText("Workload Name"), {
      target: { value: "Midterms" },
    });
    fireEvent.change(screen.getByLabelText("Task 2 name"), {
      target: { value: "Problem sets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const saved = onSave.mock.calls[0][0] as ActiveWorkload;
    expect(saved.name).toBe("Midterms");
    expect(saved.tasks[1].name).toBe("Problem sets");
    expect(saved.tasks[1].completed).toBe(1);
  });

  it("adds and removes tasks", () => {
    const { onSave } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByLabelText("Task 4 name"), {
      target: { value: "Flashcards" },
    });
    fireEvent.change(screen.getByLabelText("Task 4 total"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByLabelText("Remove Practice"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const saved = onSave.mock.calls[0][0] as ActiveWorkload;
    expect(saved.tasks.map((t) => t.name)).toEqual([
      "Read",
      "Review",
      "Flashcards",
    ]);
    expect(saved.tasks[2]).toMatchObject({ total: 20, completed: 0 });
  });

  it("warns and clamps when a total is lowered below completed", () => {
    const { onSave } = setup();

    fireEvent.change(screen.getByLabelText("Task 1 total"), {
      target: { value: "5" },
    });

    expect(
      screen.getByText("8 done now. Saving will lower it to 5.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const saved = onSave.mock.calls[0][0] as ActiveWorkload;
    expect(saved.tasks[0]).toMatchObject({ total: 5, completed: 5 });
    expect(toast.message).toHaveBeenCalled();
  });

  it("shows validation errors and does not save", () => {
    const { onSave, onClose } = setup();

    fireEvent.change(screen.getByLabelText("Workload Name"), {
      target: { value: "  " },
    });
    fireEvent.change(screen.getByLabelText("Task 3 total"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Workload name/);
    expect(alert.textContent).toMatch(/"Review"/);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without saving when nothing changed", () => {
    const { onSave, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cancel and Escape close without saving", () => {
    const { onSave, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("can't remove the last remaining task", () => {
    setup();

    fireEvent.click(screen.getByLabelText("Remove Practice"));
    fireEvent.click(screen.getByLabelText("Remove Review"));

    expect(screen.getByLabelText("Remove Read")).toHaveProperty(
      "disabled",
      true
    );
  });
});
