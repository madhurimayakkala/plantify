// lib/streaks.ts
//
// Pure helpers for the garden page: streak counting and chart data.
// No React, no browser APIs, no Date.now() — callers pass `now` in, so
// everything here is deterministic and unit-testable.
import type { GardenEntry } from "./types";

/**
 * WHAT COUNTS AS A STREAK
 *
 * - A "day" is a calendar day in the user's local time zone (or the explicit
 *   `timeZone` passed in; tests use that to stay deterministic). Each entry's
 *   `savedAt` instant is converted to that zone's calendar date.
 * - A day counts once, no matter how many cycles were saved on it. Saving
 *   three plants on Tuesday is a one-day streak, not three.
 * - Two days are consecutive when their calendar dates differ by exactly one.
 *   A gap of more than one day (a whole missed calendar day) ends the run.
 * - The CURRENT streak is the run that ends today or yesterday. If your last
 *   save was yesterday you still have today to extend it, so it is not lost
 *   yet. If the last save was two or more days ago, the current streak is 0.
 * - The LONGEST streak is the longest run anywhere in the history.
 * - Entries with an unparseable `savedAt` are ignored. Entries dated after
 *   today (clock skew, a wrong device clock) never count toward the CURRENT
 *   streak, so they can't inflate it, but they still count toward LONGEST.
 */

export interface StreakResult {
  /** Consecutive days ending today or yesterday; 0 if the run has lapsed. */
  current: number;
  /** Longest run of consecutive days in the whole history. */
  longest: number;
  /** Number of distinct calendar days with at least one saved cycle. */
  activeDays: number;
  /** Local calendar date (YYYY-MM-DD) of the most recent save, or null. */
  lastSavedDay: string | null;
}

export interface StreakOptions {
  /** The moment treated as "now". */
  now: Date;
  /** IANA zone, e.g. "Asia/Kolkata". Omit to use the runtime's local zone. */
  timeZone?: string;
}

/** Calendar date (YYYY-MM-DD) of an instant in the given zone. */
export function toLocalDay(date: Date, timeZone?: string): string {
  // The "en-CA" locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Whole-day index for a YYYY-MM-DD string, immune to DST (computed in UTC). */
function dayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function computeStreaks(
  entries: Pick<GardenEntry, "savedAt">[],
  { now, timeZone }: StreakOptions
): StreakResult {
  const today = dayIndex(toLocalDay(now, timeZone));

  const days = new Set<number>();
  for (const entry of entries) {
    const saved = new Date(entry.savedAt);
    if (Number.isNaN(saved.getTime())) continue;
    days.add(dayIndex(toLocalDay(saved, timeZone)));
  }

  if (days.size === 0) {
    return { current: 0, longest: 0, activeDays: 0, lastSavedDay: null };
  }

  const sorted = [...days].sort((a, b) => a - b);

  // Longest run across the whole history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] - sorted[i - 1] === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current run: walk back from the latest non-future day.
  const pastDays = sorted.filter((d) => d <= today);
  let current = 0;
  if (pastDays.length > 0) {
    const last = pastDays[pastDays.length - 1];
    if (today - last <= 1) {
      current = 1;
      for (let i = pastDays.length - 1; i > 0; i--) {
        if (pastDays[i] - pastDays[i - 1] !== 1) break;
        current++;
      }
    }
  }

  const lastIdx = sorted[sorted.length - 1];
  const lastSavedDay = new Date(lastIdx * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return { current, longest, activeDays: sorted.length, lastSavedDay };
}

export interface ChartPoint {
  id: string;
  savedAt: string;
  /** Local calendar date, for labels and the text alternative. */
  day: string;
  waterPercent: number;
  workloadName: string;
}

/**
 * Entries oldest → newest, ready to plot. Invalid dates are dropped and
 * waterPercent is clamped to 0–100. Ties keep their original order.
 */
export function toChartPoints(
  entries: GardenEntry[],
  timeZone?: string
): ChartPoint[] {
  return entries
    .map((entry, index) => ({ entry, index, time: new Date(entry.savedAt) }))
    .filter(({ time }) => !Number.isNaN(time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime() || a.index - b.index)
    .map(({ entry, time }) => ({
      id: entry.id,
      savedAt: entry.savedAt,
      day: toLocalDay(time, timeZone),
      waterPercent: Math.min(100, Math.max(0, entry.waterPercent)),
      workloadName: entry.workloadName,
    }));
}
