"use client";

import { useId, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy } from "lucide-react";
import type { GardenEntry } from "@/lib/types";
import { computeStreaks, toChartPoints } from "@/lib/streaks";

const MAX_CHART_POINTS = 30;

// Chart geometry (SVG user units; the SVG scales to its container width).
const W = 600;
const H = 220;
const PAD = { top: 16, right: 20, bottom: 32, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatDay(day: string) {
  // day is YYYY-MM-DD; build it in UTC so no zone shift can move the date.
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function GardenInsights({
  entries,
}: {
  entries: GardenEntry[];
}) {
  // Captured once so render stays pure and the streak doesn't flicker.
  const [now] = useState(() => new Date());
  const titleId = useId();
  const descId = useId();

  if (entries.length === 0) return null;

  const streaks = computeStreaks(entries, { now });
  const allPoints = toChartPoints(entries);
  const points = allPoints.slice(-MAX_CHART_POINTS);

  const x = (i: number) =>
    PAD.left +
    (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const y = (pct: number) => PAD.top + PLOT_H - (pct / 100) * PLOT_H;

  const line = points.map((p, i) => `${x(i)},${y(p.waterPercent)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  const summary = first
    ? `Water percent for your ${plural(points.length, "most recent plant")}, ` +
      `from ${formatDay(first.day)} to ${formatDay(last.day)}. ` +
      `Latest: ${Math.round(last.waterPercent)}%.`
    : "No dated plants to chart yet.";

  const stats = [
    {
      label: "Current streak",
      value: plural(streaks.current, "day"),
      icon: <Flame size={16} aria-hidden="true" />,
      color: "#c9742a",
      bg: "#fff3e6",
    },
    {
      label: "Longest streak",
      value: plural(streaks.longest, "day"),
      icon: <Trophy size={16} aria-hidden="true" />,
      color: "#d9a441",
      bg: "#fff8e7",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Streaks and growth history"
      className="mb-8"
    >
      <div className="flex gap-4 mb-4 flex-wrap">
        {stats.map((s) => (
          <div
            key={s.label}
            className="px-5 py-3 rounded-xl flex flex-col"
            style={{ background: s.bg, border: `1px solid ${s.color}33` }}
          >
            <span
              className="text-xl font-bold tabular-nums flex items-center gap-2"
              style={{ color: s.color }}
            >
              {s.icon}
              {s.value}
            </span>
            <span className="text-xs" style={{ color: "#6b5a4a" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {points.length > 0 && (
        <div
          className="rounded-2xl p-4 md:p-5"
          style={{ background: "#fefcf7", border: "1px solid #e8e0d5" }}
        >
          <h2
            className="font-bold text-lg mb-1"
            style={{ color: "#2d1b0e", fontFamily: "'Lora', Georgia, serif" }}
          >
            Growth over time
          </h2>
          <p className="text-xs mb-3" style={{ color: "#9b8878" }}>
            Water % for each saved plant
            {allPoints.length > points.length
              ? ` (latest ${MAX_CHART_POINTS} of ${allPoints.length})`
              : ""}
            .
          </p>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>Growth over time</title>
            <desc id={descId}>{summary}</desc>

            {[0, 50, 100].map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="#e8e0d5"
                  strokeDasharray={tick === 0 ? undefined : "4 4"}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#9b8878"
                >
                  {tick}%
                </text>
              </g>
            ))}

            {points.length > 1 && (
              <polyline
                points={line}
                fill="none"
                stroke="#7cb87a"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {points.map((p, i) => (
              <circle
                key={p.id}
                cx={x(i)}
                cy={y(p.waterPercent)}
                r="4"
                fill="#3d6b35"
                stroke="#fefcf7"
                strokeWidth="2"
              >
                <title>{`${p.workloadName}: ${Math.round(p.waterPercent)}% on ${formatDay(p.day)}`}</title>
              </circle>
            ))}

            <text x={PAD.left} y={H - 8} fontSize="11" fill="#9b8878">
              {formatDay(first.day)}
            </text>
            {points.length > 1 && (
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                fontSize="11"
                fill="#9b8878"
              >
                {formatDay(last.day)}
              </text>
            )}
          </svg>

          <details className="mt-3">
            <summary
              className="text-xs cursor-pointer"
              style={{ color: "#6b5a4a" }}
            >
              View as table
            </summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm" style={{ color: "#2d1b0e" }}>
                <caption className="sr-only">
                  Water percent for each saved plant, oldest first
                </caption>
                <thead>
                  <tr style={{ color: "#6b5a4a" }}>
                    <th scope="col" className="text-left py-1 pr-4 font-medium">
                      Date
                    </th>
                    <th scope="col" className="text-left py-1 pr-4 font-medium">
                      Workload
                    </th>
                    <th scope="col" className="text-right py-1 font-medium">
                      Water
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid #e8e0d5" }}>
                      <td className="py-1 pr-4 whitespace-nowrap">
                        {formatDay(p.day)}
                      </td>
                      <td className="py-1 pr-4">{p.workloadName}</td>
                      <td className="py-1 text-right tabular-nums">
                        {Math.round(p.waterPercent)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </motion.section>
  );
}
