import { describe, expect, it } from "vitest";
import { computeStreaks, toChartPoints, toLocalDay } from "./streaks";
import type { GardenEntry } from "./types";

const UTC = "UTC";
const at = (iso: string) => ({ savedAt: iso });
const now = (iso: string) => new Date(iso);

function entry(id: string, savedAt: string, waterPercent = 50): GardenEntry {
  return {
    id,
    workloadName: `Workload ${id}`,
    savedAt,
    waterPercent,
    stage: "sprout",
    stageEmoji: "🌱",
    tasksCompleted: 1,
    tasksTotal: 2,
  };
}

describe("computeStreaks", () => {
  it("returns zeros for an empty garden", () => {
    expect(
      computeStreaks([], { now: now("2026-10-24T12:00:00Z"), timeZone: UTC })
    ).toEqual({ current: 0, longest: 0, activeDays: 0, lastSavedDay: null });
  });

  it("counts a single save today as a 1-day streak", () => {
    const r = computeStreaks([at("2026-10-24T08:00:00Z")], {
      now: now("2026-10-24T12:00:00Z"),
      timeZone: UTC,
    });
    expect(r).toMatchObject({ current: 1, longest: 1, activeDays: 1 });
    expect(r.lastSavedDay).toBe("2026-10-24");
  });

  it("counts multiple saves on the same day once", () => {
    const r = computeStreaks(
      [
        at("2026-10-24T01:00:00Z"),
        at("2026-10-24T09:00:00Z"),
        at("2026-10-24T23:59:00Z"),
      ],
      { now: now("2026-10-24T23:59:59Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 1, longest: 1, activeDays: 1 });
  });

  it("counts consecutive days", () => {
    const r = computeStreaks(
      [
        at("2026-10-22T10:00:00Z"),
        at("2026-10-23T10:00:00Z"),
        at("2026-10-24T10:00:00Z"),
      ],
      { now: now("2026-10-24T12:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 3, longest: 3, activeDays: 3 });
  });

  it("does not depend on input order", () => {
    const r = computeStreaks(
      [
        at("2026-10-24T10:00:00Z"),
        at("2026-10-22T10:00:00Z"),
        at("2026-10-23T10:00:00Z"),
      ],
      { now: now("2026-10-24T12:00:00Z"), timeZone: UTC }
    );
    expect(r.current).toBe(3);
  });

  it("keeps the streak alive if the last save was yesterday", () => {
    const r = computeStreaks(
      [at("2026-10-22T10:00:00Z"), at("2026-10-23T10:00:00Z")],
      { now: now("2026-10-24T08:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 2, longest: 2 });
  });

  it("resets the current streak after a missed whole day", () => {
    const r = computeStreaks(
      [at("2026-10-21T10:00:00Z"), at("2026-10-22T10:00:00Z")],
      { now: now("2026-10-24T08:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 0, longest: 2 });
  });

  it("a gap splits runs; longest is the best run, current is the latest", () => {
    const r = computeStreaks(
      [
        at("2026-10-10T10:00:00Z"),
        at("2026-10-11T10:00:00Z"),
        at("2026-10-12T10:00:00Z"),
        at("2026-10-13T10:00:00Z"),
        // 14th and 15th missed
        at("2026-10-16T10:00:00Z"),
        at("2026-10-17T10:00:00Z"),
      ],
      { now: now("2026-10-17T20:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 2, longest: 4, activeDays: 6 });
  });

  it("a one-day gap (two days apart) breaks the run", () => {
    const r = computeStreaks(
      [at("2026-10-22T10:00:00Z"), at("2026-10-24T10:00:00Z")],
      { now: now("2026-10-24T12:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 1, longest: 1 });
  });

  it("ignores entries with an invalid savedAt", () => {
    const r = computeStreaks(
      [at("not a date"), at(""), at("2026-10-24T10:00:00Z")],
      { now: now("2026-10-24T12:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 1, longest: 1, activeDays: 1 });
  });

  it("ignores future-dated entries for the current streak", () => {
    const r = computeStreaks(
      [at("2026-10-23T10:00:00Z"), at("2026-10-30T10:00:00Z")],
      { now: now("2026-10-24T12:00:00Z"), timeZone: UTC }
    );
    expect(r.current).toBe(1);
  });

  it("handles month and year boundaries", () => {
    const r = computeStreaks(
      [
        at("2026-12-30T10:00:00Z"),
        at("2026-12-31T10:00:00Z"),
        at("2027-01-01T10:00:00Z"),
      ],
      { now: now("2027-01-01T12:00:00Z"), timeZone: UTC }
    );
    expect(r).toMatchObject({ current: 3, longest: 3 });
  });

  it("handles leap days", () => {
    const r = computeStreaks(
      [
        at("2028-02-28T10:00:00Z"),
        at("2028-02-29T10:00:00Z"),
        at("2028-03-01T10:00:00Z"),
      ],
      { now: now("2028-03-01T12:00:00Z"), timeZone: UTC }
    );
    expect(r.longest).toBe(3);
  });

  describe("time zones", () => {
    it("uses the local calendar day, not the UTC day", () => {
      // 23:30 and 00:30 IST (UTC+5:30) are 18:00 and 19:00 UTC on the
      // same UTC day, but two different local days.
      const entries = [
        at("2026-10-23T18:00:00Z"), // 2026-10-23 23:30 IST
        at("2026-10-23T19:00:00Z"), // 2026-10-24 00:30 IST
      ];
      const now_ = now("2026-10-24T10:00:00Z");
      expect(
        computeStreaks(entries, { now: now_, timeZone: UTC }).longest
      ).toBe(1);
      expect(
        computeStreaks(entries, { now: now_, timeZone: "Asia/Kolkata" }).longest
      ).toBe(2);
    });

    it("merges two UTC days into one local day when they share a date", () => {
      // In Los Angeles (UTC-7 in October) both of these are Oct 23.
      const r = computeStreaks(
        [at("2026-10-23T08:00:00Z"), at("2026-10-24T05:00:00Z")],
        { now: now("2026-10-24T05:30:00Z"), timeZone: "America/Los_Angeles" }
      );
      expect(r).toMatchObject({ activeDays: 1, longest: 1, current: 1 });
    });

    it("evaluates 'today' in the user's zone, not UTC", () => {
      // It is already Oct 25 in Kolkata but still Oct 24 in UTC.
      const entries = [at("2026-10-24T10:00:00Z")]; // Oct 24 15:30 IST
      const nowInstant = now("2026-10-24T20:00:00Z"); // Oct 25 01:30 IST
      expect(
        computeStreaks(entries, { now: nowInstant, timeZone: UTC }).current
      ).toBe(1);
      // Yesterday in IST: still alive, grace day.
      expect(
        computeStreaks(entries, { now: nowInstant, timeZone: "Asia/Kolkata" })
          .current
      ).toBe(1);
      // One more day later in IST it has lapsed.
      expect(
        computeStreaks(entries, {
          now: now("2026-10-25T20:00:00Z"),
          timeZone: "Asia/Kolkata",
        }).current
      ).toBe(0);
    });

    it("counts days correctly across a DST change", () => {
      // US clocks fall back on 2026-11-01; days are 25h long there.
      const r = computeStreaks(
        [
          at("2026-10-31T20:00:00Z"),
          at("2026-11-01T20:00:00Z"),
          at("2026-11-02T20:00:00Z"),
        ],
        { now: now("2026-11-02T21:00:00Z"), timeZone: "America/New_York" }
      );
      expect(r).toMatchObject({ current: 3, longest: 3 });
    });
  });
});

describe("toLocalDay", () => {
  it("formats as YYYY-MM-DD in the given zone", () => {
    const d = new Date("2026-10-23T19:00:00Z");
    expect(toLocalDay(d, "UTC")).toBe("2026-10-23");
    expect(toLocalDay(d, "Asia/Kolkata")).toBe("2026-10-24");
  });
});

describe("toChartPoints", () => {
  it("sorts oldest to newest without mutating the input", () => {
    const input = [
      entry("b", "2026-10-24T10:00:00Z"),
      entry("a", "2026-10-22T10:00:00Z"),
      entry("c", "2026-10-23T10:00:00Z"),
    ];
    const copy = [...input];
    expect(toChartPoints(input, UTC).map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(input).toEqual(copy);
  });

  it("returns an empty array for an empty garden", () => {
    expect(toChartPoints([], UTC)).toEqual([]);
  });

  it("drops invalid dates and clamps waterPercent to 0-100", () => {
    const pts = toChartPoints(
      [
        entry("bad", "nope"),
        entry("hi", "2026-10-22T10:00:00Z", 140),
        entry("lo", "2026-10-23T10:00:00Z", -5),
      ],
      UTC
    );
    expect(pts.map((p) => [p.id, p.waterPercent])).toEqual([
      ["hi", 100],
      ["lo", 0],
    ]);
  });

  it("keeps original order for identical timestamps", () => {
    const pts = toChartPoints(
      [
        entry("first", "2026-10-22T10:00:00Z"),
        entry("second", "2026-10-22T10:00:00Z"),
      ],
      UTC
    );
    expect(pts.map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("labels each point with its local day", () => {
    const [p] = toChartPoints(
      [entry("x", "2026-10-23T19:00:00Z")],
      "Asia/Kolkata"
    );
    expect(p.day).toBe("2026-10-24");
  });
});
