// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const useUserMock = vi.fn();
vi.mock("@clerk/nextjs", () => ({ useUser: () => useUserMock() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { useWorkload } from "./useWorkload";
import {
  enableGuestMode,
  isGuestMode,
  setGuestWorkload,
  addGuestGardenEntry,
  getGuestGarden,
} from "@/lib/guestStorage";
import type { ActiveWorkload, GardenEntry } from "@/lib/types";

const guestWorkload: ActiveWorkload = {
  id: "w1",
  name: "Guest plan",
  tasks: [{ id: "t1", name: "Read", total: 10, completed: 3 }],
  startedAt: "2026-01-01T00:00:00.000Z",
  cumulativeWater: 0,
};

const gardenEntry: GardenEntry = {
  id: "7b1f3f0e-3d1c-4d3a-9d77-0b5a3c1f2a10",
  workloadName: "Old plan",
  savedAt: "2026-01-01T00:00:00.000Z",
  waterPercent: 100,
  stage: "tree",
  stageEmoji: "🌳",
  tasksCompleted: 5,
  tasksTotal: 5,
};

const fetchMock = vi.fn();

function signedOut() {
  useUserMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
}
function signedIn() {
  useUserMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
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

describe("useWorkload", () => {
  it("shows the welcome state for a visitor who is neither guest nor signed in", () => {
    signedOut();
    const { result } = renderHook(() => useWorkload());

    expect(result.current.guestChecked).toBe(true);
    expect(result.current.guest).toBe(false);
    expect(result.current.workload).toBeNull();
    expect(result.current.createOpen).toBe(false);
  });

  it("continue as guest opens the create modal when there's no workload", async () => {
    signedOut();
    const { result } = renderHook(() => useWorkload());

    act(() => result.current.handleContinueAsGuest());

    await waitFor(() => expect(result.current.createOpen).toBe(true));
    expect(result.current.guest).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a guest's stored workload without touching the network", async () => {
    enableGuestMode();
    setGuestWorkload(guestWorkload);
    signedOut();

    const { result } = renderHook(() => useWorkload());

    await waitFor(() => expect(result.current.workload).toEqual(guestWorkload));
    expect(result.current.createOpen).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a signed-in user's workload from the server", async () => {
    signedIn();
    fetchMock.mockResolvedValue(
      Response.json({
        id: "srv1",
        name: "Server plan",
        tasks: guestWorkload.tasks,
        started_at: "2026-02-01T00:00:00.000Z",
        cumulative_water: 12,
      })
    );

    const { result } = renderHook(() => useWorkload());

    await waitFor(() => expect(result.current.workload).not.toBeNull());
    expect(result.current.workload).toEqual({
      id: "srv1",
      name: "Server plan",
      tasks: guestWorkload.tasks,
      startedAt: "2026-02-01T00:00:00.000Z",
      cumulativeWater: 12,
    });
  });

  it("opens the create modal when a signed-in user has no workload", async () => {
    signedIn();
    fetchMock.mockResolvedValue(Response.json(null));

    const { result } = renderHook(() => useWorkload());

    await waitFor(() => expect(result.current.createOpen).toBe(true));
  });

  describe("guest -> account migration", () => {
    function seedGuest() {
      enableGuestMode();
      setGuestWorkload(guestWorkload);
      addGuestGardenEntry(gardenEntry);
    }

    it("clears guest data and toasts success only when every request succeeded", async () => {
      seedGuest();
      signedIn();
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/workload" && (init?.method ?? "GET") === "GET") {
          return Promise.resolve(Response.json(null));
        }
        return Promise.resolve(Response.json({}));
      });

      renderHook(() => useWorkload());

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          "Your guest progress has been saved!",
          expect.anything()
        )
      );
      expect(isGuestMode()).toBe(false);
      expect(getGuestGarden()).toEqual([]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("keeps guest data and the flag, and toasts an error, when a request fails", async () => {
      seedGuest();
      signedIn();
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          url === "/api/garden"
            ? new Response("{}", { status: 500 })
            : Response.json(null)
        )
      );

      renderHook(() => useWorkload());

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "We couldn't save all of your guest progress",
          expect.anything()
        )
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(isGuestMode()).toBe(true);
      expect(getGuestGarden()).toHaveLength(1);
    });

    it("only attempts migration once per session", async () => {
      seedGuest();
      signedIn();
      fetchMock.mockImplementation((url: string, init?: RequestInit) =>
        Promise.resolve(
          url === "/api/workload" && (init?.method ?? "GET") === "GET"
            ? Response.json(null)
            : Response.json({})
        )
      );

      const { rerender } = renderHook(() => useWorkload());
      await waitFor(() => expect(toast.success).toHaveBeenCalled());

      rerender();
      rerender();

      const gardenPosts = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/garden" && init?.method === "POST"
      );
      expect(gardenPosts).toHaveLength(1);
    });
  });
});
