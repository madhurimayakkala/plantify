// lib/migrateGuestData.test.ts
import { describe, it, expect } from "vitest";
import { migrateGuestData } from "./migrateGuestData";
import type { ActiveWorkload, GardenEntry } from "./types";

function entry(id: string): GardenEntry {
  return {
    id,
    workloadName: `Workload ${id}`,
    savedAt: "2026-01-01T00:00:00.000Z",
    waterPercent: 100,
    stage: "tree",
    stageEmoji: "🌳",
    tasksCompleted: 5,
    tasksTotal: 5,
  };
}

const workload: ActiveWorkload = {
  id: "w1",
  name: "Finals",
  tasks: [{ id: "t1", name: "Read", total: 10, completed: 4 }],
  startedAt: "2026-01-02T00:00:00.000Z",
  cumulativeWater: 0,
};

/**
 * In-memory stand-in for the API. Mirrors the contract of the real routes:
 * POST /api/garden is idempotent on the client-supplied id, GET /api/workload
 * returns the stored workload or null, PUT /api/workload stores it.
 * `failOn` lets a test make specific requests fail with a given status.
 */
function createFakeApi(
  opts: {
    existingWorkload?: unknown;
    failOn?: (call: {
      method: string;
      url: string;
      id?: string;
    }) => number | null;
  } = {}
) {
  const garden = new Map<string, GardenEntry>();
  const gardenPostIds: string[] = [];
  let workloadStore: unknown = opts.existingWorkload ?? null;
  let workloadPuts = 0;

  const fetchFn = async (
    url: string,
    init?: RequestInit
  ): Promise<Response> => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    const failStatus = opts.failOn?.({ method, url, id: body?.id }) ?? null;
    if (failStatus) {
      return new Response(JSON.stringify({ error: "boom" }), {
        status: failStatus,
      });
    }

    if (url === "/api/garden" && method === "POST") {
      gardenPostIds.push(body.id);
      if (!garden.has(body.id)) garden.set(body.id, body);
      return Response.json(body);
    }

    if (url === "/api/workload" && method === "GET") {
      return Response.json(workloadStore);
    }

    if (url === "/api/workload" && method === "PUT") {
      workloadPuts++;
      workloadStore = body;
      return Response.json(body);
    }

    return new Response("not found", { status: 404 });
  };

  return {
    fetchFn,
    garden,
    gardenPostIds,
    get workloadStore() {
      return workloadStore;
    },
    get workloadPuts() {
      return workloadPuts;
    },
  };
}

describe("migrateGuestData", () => {
  describe("success", () => {
    it("resolves and saves every garden entry and the workload", async () => {
      const api = createFakeApi();

      await expect(
        migrateGuestData({
          garden: [entry("a"), entry("b")],
          workload,
          fetchFn: api.fetchFn,
        })
      ).resolves.toBeUndefined();

      expect([...api.garden.keys()]).toEqual(["a", "b"]);
      expect(api.workloadPuts).toBe(1);
      expect(api.workloadStore).toEqual({
        name: "Finals",
        tasks: workload.tasks,
        started_at: workload.startedAt,
        cumulative_water: 0,
      });
    });

    it("sends the client-generated id with each garden entry", async () => {
      const api = createFakeApi();

      await migrateGuestData({
        garden: [entry("a")],
        workload: null,
        fetchFn: api.fetchFn,
      });

      expect(api.gardenPostIds).toEqual(["a"]);
    });

    it("does not overwrite a workload the account already has", async () => {
      const existing = { name: "Real progress" };
      const api = createFakeApi({ existingWorkload: existing });

      await migrateGuestData({
        garden: [],
        workload,
        fetchFn: api.fetchFn,
      });

      expect(api.workloadPuts).toBe(0);
      expect(api.workloadStore).toEqual(existing);
    });

    it("makes no requests when there is nothing to migrate", async () => {
      const api = createFakeApi();

      await migrateGuestData({
        garden: [],
        workload: null,
        fetchFn: api.fetchFn,
      });

      expect(api.gardenPostIds).toEqual([]);
      expect(api.workloadPuts).toBe(0);
    });
  });

  describe("failure", () => {
    it("throws when a garden save returns a non-2xx response", async () => {
      const api = createFakeApi({
        failOn: ({ url }) => (url === "/api/garden" ? 500 : null),
      });

      await expect(
        migrateGuestData({
          garden: [entry("a")],
          workload,
          fetchFn: api.fetchFn,
        })
      ).rejects.toThrow(/status 500/);
    });

    it("stops at the first failure and does not touch the workload", async () => {
      const api = createFakeApi({
        failOn: ({ url, id }) =>
          url === "/api/garden" && id === "b" ? 401 : null,
      });

      await expect(
        migrateGuestData({
          garden: [entry("a"), entry("b"), entry("c")],
          workload,
          fetchFn: api.fetchFn,
        })
      ).rejects.toThrow();

      expect([...api.garden.keys()]).toEqual(["a"]);
      expect(api.workloadPuts).toBe(0);
    });

    it("throws and does NOT write when the existing-workload check fails", async () => {
      const api = createFakeApi({
        failOn: ({ url, method }) =>
          url === "/api/workload" && method === "GET" ? 500 : null,
      });

      await expect(
        migrateGuestData({ garden: [], workload, fetchFn: api.fetchFn })
      ).rejects.toThrow(/existing workload/);

      expect(api.workloadPuts).toBe(0);
    });

    it("throws when saving the workload fails", async () => {
      const api = createFakeApi({
        failOn: ({ url, method }) =>
          url === "/api/workload" && method === "PUT" ? 500 : null,
      });

      await expect(
        migrateGuestData({ garden: [], workload, fetchFn: api.fetchFn })
      ).rejects.toThrow(/Saving workload/);
    });

    it("propagates network errors", async () => {
      const fetchFn = async () => {
        throw new TypeError("Failed to fetch");
      };

      await expect(
        migrateGuestData({ garden: [entry("a")], workload: null, fetchFn })
      ).rejects.toThrow("Failed to fetch");
    });
  });

  describe("retry after partial failure", () => {
    it("produces no duplicate garden entries", async () => {
      const guestGarden = [entry("a"), entry("b"), entry("c")];
      let failBOnce = true;

      const api = createFakeApi({
        failOn: ({ url, id }) => {
          if (url === "/api/garden" && id === "b" && failBOnce) {
            failBOnce = false;
            return 500;
          }
          return null;
        },
      });

      // First attempt: "a" saves, "b" fails.
      await expect(
        migrateGuestData({
          garden: guestGarden,
          workload,
          fetchFn: api.fetchFn,
        })
      ).rejects.toThrow();
      expect([...api.garden.keys()]).toEqual(["a"]);

      // Retry with the same local data (guest storage wasn't cleared).
      await migrateGuestData({
        garden: guestGarden,
        workload,
        fetchFn: api.fetchFn,
      });

      // "a" was sent twice, but with the same id both times, so the
      // idempotent server holds exactly one copy of each entry.
      expect(api.gardenPostIds.filter((id) => id === "a")).toHaveLength(2);
      expect([...api.garden.keys()]).toEqual(["a", "b", "c"]);
      expect(api.garden.size).toBe(3);
      expect(api.workloadPuts).toBe(1);
    });

    it("doesn't re-write a workload that already saved on a previous attempt", async () => {
      let failGarden = true;
      const api = createFakeApi({
        failOn: ({ url }) => {
          if (url === "/api/garden" && failGarden) {
            failGarden = false;
            return 503;
          }
          return null;
        },
      });

      await expect(
        migrateGuestData({
          garden: [entry("a")],
          workload,
          fetchFn: api.fetchFn,
        })
      ).rejects.toThrow();

      await migrateGuestData({
        garden: [entry("a")],
        workload,
        fetchFn: api.fetchFn,
      });

      expect(api.garden.size).toBe(1);
      expect(api.workloadPuts).toBe(1);
    });
  });
});
