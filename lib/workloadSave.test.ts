import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveWorkload, type SaveWorkloadInput } from "./workloadSave";

/**
 * A tiny in-memory stand-in for the slice of supabase-js that saveWorkload
 * uses: insert / update+eq+eq / select+eq+maybeSingle. It enforces the same
 * rules Postgres would: one row per user_id, and updates only touch rows
 * matching every .eq() filter.
 */
interface Row {
  user_id: string;
  name: string;
  updated_at: string;
  [key: string]: unknown;
}

function fakeDb(initial: Row[] = []) {
  const rows = [...initial];

  const db = {
    rows,
    from() {
      return {
        insert(values: Row) {
          const result = () => {
            if (rows.some((r) => r.user_id === values.user_id)) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key" },
              };
            }
            rows.push({ ...values });
            return { data: { ...values }, error: null };
          };
          return { select: () => ({ single: async () => result() }) };
        },
        update(values: Partial<Row>) {
          const filters: [string, unknown][] = [];
          const chain = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              return chain;
            },
            select: async () => {
              const hit = rows.filter((r) =>
                filters.every(([c, v]) => r[c] === v)
              );
              hit.forEach((r) => Object.assign(r, values));
              return { data: hit.map((r) => ({ ...r })), error: null };
            },
          };
          return chain;
        },
        select() {
          const filters: [string, unknown][] = [];
          const chain = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              return chain;
            },
            maybeSingle: async () => {
              const hit = rows.find((r) =>
                filters.every(([c, v]) => r[c] === v)
              );
              return { data: hit ? { ...hit } : null, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return db;
}

const asClient = (db: ReturnType<typeof fakeDb>) =>
  db as unknown as SupabaseClient;

function input(over: Partial<SaveWorkloadInput> = {}): SaveWorkloadInput {
  return {
    name: "Finals",
    tasks: [{ id: "t1", name: "Read", total: 10, completed: 1 }],
    started_at: "2026-01-01T00:00:00.000Z",
    cumulative_water: 0,
    expected_updated_at: null,
    ...over,
  };
}

const existing = (over: Partial<Row> = {}): Row => ({
  user_id: "u1",
  name: "Old",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("saveWorkload", () => {
  describe("first-time creation (expected_updated_at null)", () => {
    it("inserts when the user has no row", async () => {
      const db = fakeDb();
      const res = await saveWorkload(asClient(db), "u1", input());

      expect(res.status).toBe("ok");
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0]).toMatchObject({ user_id: "u1", name: "Finals" });
    });

    it("stamps updated_at on the server and never stores the client's token", async () => {
      const db = fakeDb();
      await saveWorkload(asClient(db), "u1", input());

      expect(typeof db.rows[0].updated_at).toBe("string");
      expect("expected_updated_at" in db.rows[0]).toBe(false);
    });

    it("reports a conflict, with the current row, if the user already has one", async () => {
      const db = fakeDb([existing({ name: "From another tab" })]);
      const res = await saveWorkload(asClient(db), "u1", input());

      expect(res.status).toBe("conflict");
      if (res.status === "conflict") {
        expect(res.current?.name).toBe("From another tab");
      }
      expect(db.rows[0].name).toBe("From another tab"); // not overwritten
    });
  });

  describe("updates (expected_updated_at set)", () => {
    it("updates when the token matches and returns a new updated_at", async () => {
      const db = fakeDb([existing()]);
      const res = await saveWorkload(
        asClient(db),
        "u1",
        input({ expected_updated_at: "2026-01-01T00:00:00.000Z" })
      );

      expect(res.status).toBe("ok");
      expect(db.rows[0].name).toBe("Finals");
      expect(db.rows[0].updated_at).not.toBe("2026-01-01T00:00:00.000Z");
      if (res.status === "ok") {
        expect(res.workload.name).toBe("Finals");
      }
    });

    it("rejects a stale token with a conflict carrying the current row", async () => {
      const db = fakeDb([
        existing({ name: "Newer", updated_at: "2026-02-02T00:00:00.000Z" }),
      ]);
      const res = await saveWorkload(
        asClient(db),
        "u1",
        input({ expected_updated_at: "2026-01-01T00:00:00.000Z" })
      );

      expect(res.status).toBe("conflict");
      if (res.status === "conflict") {
        expect(res.current?.name).toBe("Newer");
      }
      expect(db.rows[0].name).toBe("Newer"); // untouched
    });

    it("reports a conflict with current null when the row was deleted", async () => {
      const db = fakeDb();
      const res = await saveWorkload(
        asClient(db),
        "u1",
        input({ expected_updated_at: "2026-01-01T00:00:00.000Z" })
      );

      expect(res).toEqual({ status: "conflict", current: null });
      expect(db.rows).toHaveLength(0); // no accidental upsert
    });

    it("never touches another user's row, even with a matching token", async () => {
      const db = fakeDb([existing({ user_id: "someone-else" })]);
      const res = await saveWorkload(
        asClient(db),
        "u1",
        input({ expected_updated_at: "2026-01-01T00:00:00.000Z" })
      );

      expect(res.status).toBe("conflict");
      expect(db.rows[0].name).toBe("Old");
    });

    it("lets only one of two writers holding the same token win", async () => {
      const db = fakeDb([existing()]);
      const token = "2026-01-01T00:00:00.000Z";

      const a = await saveWorkload(
        asClient(db),
        "u1",
        input({ name: "A", expected_updated_at: token })
      );
      // Make sure the stamps differ even if both ran in the same millisecond.
      db.rows[0].updated_at = "2026-01-01T00:00:01.000Z";
      const b = await saveWorkload(
        asClient(db),
        "u1",
        input({ name: "B", expected_updated_at: token })
      );

      expect(a.status).toBe("ok");
      expect(b.status).toBe("conflict");
      expect(db.rows[0].name).toBe("A");
    });
  });
});
