// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
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
  vi.mocked(toast.warning).mockClear();
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
      expected_updated_at: null,
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

  it("setWorkload cancels a pending debounced save so it can't overwrite the newer state", async () => {
    fetchMock.mockImplementation(okResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    // Progress tap (debounced), then an immediate save, e.g. an edit.
    act(() => result.current.updateWorkload(makeWorkload(1)));
    await act(async () => {
      await result.current.setWorkload({
        ...makeWorkload(1),
        name: "Renamed",
      });
    });
    await flushDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).name).toBe("Renamed");
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

// ---------------------------------------------------------------------------
// Optimistic concurrency
// ---------------------------------------------------------------------------

function savedResponse(updatedAt: string) {
  return Promise.resolve(
    new Response(JSON.stringify({ updated_at: updatedAt }), { status: 200 })
  );
}

function conflictResponse(current: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "changed", current }), {
      status: 409,
    })
  );
}

function sentBody(callIndex: number) {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body);
}

describe("useWorkloadSync concurrency (signed in)", () => {
  it("creates with expected_updated_at null when there is no row yet", async () => {
    fetchMock.mockImplementation(() => savedResponse("S1"));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    await act(async () => {
      await result.current.setWorkload(makeWorkload(0));
    });

    expect(sentBody(0).expected_updated_at).toBeNull();
  });

  it("sends the stamp it was hydrated with", async () => {
    fetchMock.mockImplementation(() => savedResponse("S2"));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    act(() => result.current.hydrate(makeWorkload(1), "S1"));
    act(() => result.current.updateWorkload(makeWorkload(2)));
    await flushDebounce();

    expect(sentBody(0).expected_updated_at).toBe("S1");
  });

  it("uses the stamp returned by the previous save on the next one", async () => {
    let n = 0;
    fetchMock.mockImplementation(() => savedResponse(`S${++n}`));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );

    await act(async () => {
      await result.current.setWorkload(makeWorkload(1)); // create
    });
    await act(async () => {
      await result.current.setWorkload(makeWorkload(2));
    });
    await act(async () => {
      await result.current.setWorkload(makeWorkload(3));
    });

    expect(sentBody(0).expected_updated_at).toBeNull();
    expect(sentBody(1).expected_updated_at).toBe("S1");
    expect(sentBody(2).expected_updated_at).toBe("S2");
  });

  it("sends overlapping saves one at a time so the second carries the first's stamp", async () => {
    let releaseFirst: (r: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseFirst = resolve))
      )
      .mockImplementation(() => savedResponse("S2"));

    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(0), "S0"));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.setWorkload(makeWorkload(1));
      second = result.current.setWorkload(makeWorkload(2));
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Only the first request is out; the second waits for its response.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst(new Response(JSON.stringify({ updated_at: "S1" })));
      await first;
      await second;
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(0).expected_updated_at).toBe("S0");
    expect(sentBody(1).expected_updated_at).toBe("S1");
  });

  it("on 409 shows a toast and swaps in the server's copy without rolling back", async () => {
    const serverCopy = {
      id: "w1",
      name: "Finals (edited elsewhere)",
      tasks: [{ id: "t1", name: "Read", total: 10, completed: 7 }],
      started_at: "2026-01-01T00:00:00.000Z",
      cumulative_water: 0,
      updated_at: "S9",
    };
    fetchMock.mockImplementationOnce(() => conflictResponse(serverCopy));

    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(1), "S1"));
    act(() => result.current.updateWorkload(makeWorkload(2)));
    await flushDebounce();

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled(); // not a generic failure
    expect(result.current.workload?.name).toBe("Finals (edited elsewhere)");
    expect(result.current.workload?.tasks[0].completed).toBe(7);

    // The next save builds on the server's stamp, not the stale one.
    fetchMock.mockImplementation(() => savedResponse("S10"));
    act(() => result.current.updateWorkload(makeWorkload(8)));
    await flushDebounce();
    expect(sentBody(1).expected_updated_at).toBe("S9");
  });

  it("on 409 with no current row (deleted elsewhere) clears the workload", async () => {
    fetchMock.mockImplementation(() => conflictResponse(null));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(1), "S1"));
    act(() => result.current.updateWorkload(makeWorkload(2)));
    await flushDebounce();

    expect(result.current.workload).toBeNull();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("drops a debounced save that was waiting when a conflict arrived", async () => {
    let releaseFirst: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (releaseFirst = resolve))
    );
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(0), "S0"));

    let first!: Promise<void>;
    act(() => {
      first = result.current.setWorkload(makeWorkload(1));
    });
    // A second, queued save built on the same stale data.
    let second!: Promise<void>;
    act(() => {
      second = result.current.setWorkload(makeWorkload(2));
    });

    // Let the first request actually go out before we answer it.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst(
        new Response(
          JSON.stringify({
            error: "changed",
            current: {
              id: "w1",
              name: "Finals",
              tasks: [{ id: "t1", name: "Read", total: 10, completed: 9 }],
              started_at: "2026-01-01T00:00:00.000Z",
              cumulative_water: 0,
              updated_at: "S5",
            },
          }),
          { status: 409 }
        )
      );
      await first;
      await second;
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // second never sent
    expect(result.current.workload?.tasks[0].completed).toBe(9);
  });

  it("clearWorkload resets the stamp so a re-created workload is a create", async () => {
    fetchMock.mockImplementation(() => savedResponse("S1"));
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(1), "S0"));
    act(() => result.current.clearWorkload());

    await act(async () => {
      await result.current.setWorkload(makeWorkload(0));
    });

    expect(sentBody(0).expected_updated_at).toBeNull();
  });

  it("still rolls back on a normal failure and keeps the old stamp", async () => {
    fetchMock.mockImplementationOnce(failResponse);
    const { result } = renderHook(() =>
      useWorkloadSync({ usingGuestData: false })
    );
    act(() => result.current.hydrate(makeWorkload(2), "S1"));
    act(() => result.current.updateWorkload(makeWorkload(5)));
    await flushDebounce();

    expect(result.current.workload?.tasks[0].completed).toBe(2);
    expect(toast.error).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(() => savedResponse("S2"));
    act(() => result.current.updateWorkload(makeWorkload(6)));
    await flushDebounce();
    expect(sentBody(1).expected_updated_at).toBe("S1");
  });
});
