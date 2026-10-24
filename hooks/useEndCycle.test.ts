// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { useEndCycle } from "./useEndCycle";
import {
  getGuestGarden,
  getGuestWorkload,
  setGuestWorkload,
} from "@/lib/guestStorage";
import type { ActiveWorkload } from "@/lib/types";

const workload: ActiveWorkload = {
  id: "w1",
  name: "Finals",
  tasks: [
    { id: "t1", name: "Read", total: 10, completed: 10 },
    { id: "t2", name: "Practice", total: 4, completed: 4 },
  ],
  startedAt: "2026-01-01T00:00:00.000Z",
  cumulativeWater: 0,
};

const fetchMock = vi.fn();

function setup(usingGuestData: boolean, w: ActiveWorkload | null = workload) {
  const callbacks = {
    setWorkload: vi.fn().mockResolvedValue(undefined),
    clearWorkload: vi.fn(),
    closeEndCycle: vi.fn(),
    openCreate: vi.fn(),
  };
  const hook = renderHook(() =>
    useEndCycle({ workload: w, usingGuestData, ...callbacks })
  );
  return { ...hook, callbacks };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useEndCycle", () => {
  it("does nothing without a workload", async () => {
    const { result, callbacks } = setup(true, null);

    await act(async () => result.current.handleEndChoice("reset"));

    expect(callbacks.clearWorkload).not.toHaveBeenCalled();
  });

  it("guest save_reset stores the plant locally and clears the workload", async () => {
    setGuestWorkload(workload);
    const { result, callbacks } = setup(true);

    await act(async () => result.current.handleEndChoice("save_reset"));

    const garden = getGuestGarden();
    expect(garden).toHaveLength(1);
    expect(garden[0]).toMatchObject({
      workloadName: "Finals",
      waterPercent: 100,
      stage: "tree",
      tasksCompleted: 14,
      tasksTotal: 14,
    });
    expect(getGuestWorkload()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callbacks.clearWorkload).toHaveBeenCalled();
    expect(callbacks.closeEndCycle).toHaveBeenCalled();
    expect(callbacks.openCreate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("signed-in save_reset posts the entry then deletes the workload", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = setup(false);

    await act(async () => result.current.handleEndChoice("save_reset"));

    expect(fetchMock.mock.calls[0][0]).toBe("/api/garden");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/workload");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(toast.success).toHaveBeenCalled();
  });

  it("signed-in save_reset reports a failed garden save but still resets", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response("{}", { status: url === "/api/garden" ? 500 : 200 })
      )
    );
    const { result, callbacks } = setup(false);

    await act(async () => result.current.handleEndChoice("save_reset"));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(callbacks.clearWorkload).toHaveBeenCalled();
  });

  it("continue carries the current water over and saves", async () => {
    const { result, callbacks } = setup(true);

    await act(async () => result.current.handleEndChoice("continue"));

    expect(callbacks.setWorkload).toHaveBeenCalledWith({
      ...workload,
      cumulativeWater: 100,
    });
    expect(callbacks.closeEndCycle).toHaveBeenCalled();
    expect(callbacks.openCreate).toHaveBeenCalled();
    expect(callbacks.clearWorkload).not.toHaveBeenCalled();
  });

  it("guest reset discards the workload without saving to the garden", async () => {
    setGuestWorkload(workload);
    const { result, callbacks } = setup(true);

    await act(async () => result.current.handleEndChoice("reset"));

    expect(getGuestWorkload()).toBeNull();
    expect(getGuestGarden()).toHaveLength(0);
    expect(callbacks.clearWorkload).toHaveBeenCalled();
  });

  it("signed-in reset deletes the workload on the server", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = setup(false);

    await act(async () => result.current.handleEndChoice("reset"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
