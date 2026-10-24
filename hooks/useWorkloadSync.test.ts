// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { useWorkloadSync, WORKLOAD_SAVE_DEBOUNCE_MS } from "./useWorkloadSync";
import { getGuestWorkload } from "@/lib/guestStorage";
import type { ActiveWorkload } from "@/lib/types";

function makeWorkload(completed: number): ActiveWorkload {
  return {
    id: "w1",
    name: "Finals",
    tasks: [{ id: "t1", name: "Read", total: 10, completed }],
    startedAt: "2026-01-01T00:00:00.000Z",
    cumulativeWater: 0,
  };
}

const fetchMock = vi.fn();

function okResponse() {
  return Promise.resolve(new Response("{}", { status: 200 }));
}

function failResponse() {
  return Promise.resolve(new Response("{}", { status: 500 }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(toast.error).mockClear();
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(WORKLOAD_SAVE_DEBOUNCE_MS);
  });
}

describe("useWorkloadSync (signed in)", () => {
  it("updates the UI immediately but waits to save", async () => {
    fetchMock.mockImplementation(okResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.updateWorkload(makeWorkload(1)));

    expect(result.current.workload?.tasks[0].completed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await flushDebounce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid updates into one PUT with the latest state", async () => {
    fetchMock.mockImplementation(okResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.updateWorkload(makeWorkload(1)));
    act(() => result.current.updateWorkload(makeWorkload(2)));
    act(() => result.current.updateWorkload(makeWorkload(3)));
    await flushDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/workload");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      name: "Finals",
      tasks: [{ id: "t1", name: "Read", total: 10, completed: 3 }],
      started_at: "2026-01-01T00:00:00.000Z",
      cumulative_water: 0,
    });
  });

  it("rolls back to the last saved state and offers a retry when a save fails", async () => {
    fetchMock.mockImplementation(failResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.hydrate(makeWorkload(2))); // known-good state
    act(() => result.current.updateWorkload(makeWorkload(5)));
    expect(result.current.workload?.tasks[0].completed).toBe(5);

    await flushDebounce();

    expect(result.current.workload?.tasks[0].completed).toBe(2);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const options = vi.mocked(toast.error).mock.calls[0][1] as {
      action: { label: string; onClick: () => void };
    };
    expect(options.action.label).toBe("Retry");

    // Retry re-applies the change and tries to save again.
    fetchMock.mockImplementation(okResponse);
    await act(async () => {
      options.action.onClick();
      await vi.advanceTimersByTimeAsync(WORKLOAD_SAVE_DEBOUNCE_MS);
    });
    expect(result.current.workload?.tasks[0].completed).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a network error like a failed save", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.hydrate(makeWorkload(1)));
    act(() => result.current.updateWorkload(makeWorkload(4)));
    await flushDebounce();

    expect(result.current.workload?.tasks[0].completed).toBe(1);
    expect(toast.error).toHaveBeenCalled();
  });

  it("rolls back to the most recent successful save, not the initial load", async () => {
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.hydrate(makeWorkload(0)));

    fetchMock.mockImplementation(okResponse);
    act(() => result.current.updateWorkload(makeWorkload(3)));
    await flushDebounce();

    fetchMock.mockImplementation(failResponse);
    act(() => result.current.updateWorkload(makeWorkload(7)));
    await flushDebounce();

    expect(result.current.workload?.tasks[0].completed).toBe(3);
  });

  it("setWorkload saves immediately without debouncing", async () => {
    fetchMock.mockImplementation(okResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    await act(async () => {
      await result.current.setWorkload(makeWorkload(1));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.workload?.tasks[0].completed).toBe(1);
  });

  it("drops a pending save when unmounted", async () => {
    fetchMock.mockImplementation(okResponse);
    const { result, unmount } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.updateWorkload(makeWorkload(1)));
    unmount();
    await vi.advanceTimersByTimeAsync(WORKLOAD_SAVE_DEBOUNCE_MS * 2);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clearWorkload empties the workload", () => {
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.hydrate(makeWorkload(1)));
    act(() => result.current.clearWorkload());

    expect(result.current.workload).toBeNull();
  });
});

describe("useWorkloadSync (guest)", () => {
  it("saves to localStorage after the debounce and never calls the network", async () => {
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: true })
    );

    act(() => result.current.updateWorkload(makeWorkload(2)));
    await flushDebounce();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getGuestWorkload()?.tasks[0].completed).toBe(2);
  });
});
