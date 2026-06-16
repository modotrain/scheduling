"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SkyPoint = {
  sourceId: number;
  sourceName: string | null;
  sourcePriority: string | null;
  weeklyExposure: Array<{ weekIndex: number; exposureS: number }>;
  visibleDateRanges: string | null;
};

type WeekBound = {
  weekIndex: number;
  startDate: string | null;
  endDate: string | null;
};

type Props = {
  points: SkyPoint[];
  weekBounds: WeekBound[];
  filterMode: "single" | "range";
  selectedWeek: number | null;
  weekRangeStart: number;
  weekRangeEnd: number;
};

const PRIORITY_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };
const PRIORITY_COLORS: Record<string, string> = {
  A: "#d62728",
  B: "#1f77b4",
  C: "#2ca02c",
};

const DEFAULT_W = 900; // initial / fallback SVG width
const LEFT = 180;      // label column width
const RIGHT = 20;      // right padding
const TOP = 38;        // top padding for x-axis labels
const ROW_H = 22;      // height per source row
const BAR_H = 12;      // height of each scheduled bar
const VIS_H = 8;       // height of visibility window band
const BOTTOM = 28;     // space below last row
const BAR_COLOR = "#9b59b6";
const VIS_COLOR = "#cbd5e1";

function parseDate(s: string): number {
  return new Date(s).getTime();
}

function addDays(ts: number, n: number): number {
  return ts + n * 86_400_000;
}

function parseVisibilitySegments(raw: string): Array<{ a: number; b: number }> {
  const segs: Array<{ a: number; b: number }> = [];
  const re = /(\d{4}-\d{1,2}-\d{1,2})\s*to\s*(\d{4}-\d{1,2}-\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const a = parseDate(m[1]);
    const b = parseDate(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      segs.push({ a, b });
    }
  }
  return segs;
}

/** First-of-month dates (in ms) between two timestamps, inclusive. */
function monthStartsBetween(lo: number, hi: number): Date[] {
  const months: Date[] = [];
  const start = new Date(lo);
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d.getTime() <= hi) {
    months.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

export default function SkyGanttChart({
  points,
  weekBounds,
  filterMode,
  selectedWeek,
  weekRangeStart,
  weekRangeEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_W);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgW = Math.max(containerWidth, LEFT + RIGHT + 100);
  const chartW = svgW - LEFT - RIGHT;

  const weekBoundMap = useMemo(
    () => new Map(weekBounds.map((wb) => [wb.weekIndex, wb])),
    [weekBounds],
  );

  // Set of active weekIndices to show
  const activeWeeks = useMemo<Set<number>>(() => {
    const set = new Set<number>();
    for (const wb of weekBounds) {
      if (filterMode === "single" && selectedWeek !== null) {
        if (wb.weekIndex === selectedWeek) set.add(wb.weekIndex);
      } else if (filterMode === "range") {
        if (wb.weekIndex >= weekRangeStart && wb.weekIndex <= weekRangeEnd) set.add(wb.weekIndex);
      } else {
        // show all
        set.add(wb.weekIndex);
      }
    }
    return set;
  }, [weekBounds, filterMode, selectedWeek, weekRangeStart, weekRangeEnd]);

  // Sources that have at least one observation in the active weeks
  const ganttRows = useMemo(() => {
    const active = filterMode === "single" && selectedWeek !== null;
    const filtered = points.filter((p) => {
      if (active || filterMode === "range") {
        return p.weeklyExposure.some((we) => activeWeeks.has(we.weekIndex));
      }
      return p.weeklyExposure.length > 0;
    });
    return [...filtered].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.sourcePriority ?? ""] ?? 9;
      const pb = PRIORITY_ORDER[b.sourcePriority ?? ""] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.sourceName ?? "").localeCompare(b.sourceName ?? "");
    });
  }, [points, activeWeeks, filterMode, selectedWeek]);

  // Overall date range for the active weeks ±10 day padding
  const dateRange = useMemo<{ lo: number; hi: number } | null>(() => {
    const dates: number[] = [];
    for (const weekIndex of activeWeeks) {
      const wb = weekBoundMap.get(weekIndex);
      if (wb?.startDate) dates.push(parseDate(wb.startDate));
      if (wb?.endDate) dates.push(parseDate(wb.endDate));
    }
    if (dates.length === 0) return null;
    return {
      lo: addDays(Math.min(...dates), -10),
      hi: addDays(Math.max(...dates), 10),
    };
  }, [activeWeeks, weekBoundMap]);

  const dateToX = useCallback((t: number): number => {
    if (!dateRange) return LEFT;
    const { lo, hi } = dateRange;
    const span = hi - lo || 1;
    return LEFT + ((t - lo) / span) * chartW;
  }, [dateRange, chartW]);

  const monthTicks = useMemo(() => {
    if (!dateRange) return [];
    return monthStartsBetween(dateRange.lo, dateRange.hi).map((d) => ({
      x: dateToX(d.getTime()),
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    }));
  }, [dateRange, dateToX]);

  const svgH = TOP + ROW_H * ganttRows.length + BOTTOM;

  if (ganttRows.length === 0) {
    return (
      <div className="mt-6 rounded-lg ring-1 ring-slate-200 bg-white p-4 dark:ring-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No observations in the selected week range.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg ring-1 ring-slate-200 bg-white p-4 dark:ring-slate-700 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
        Scheduling Coverage Timeline
      </h2>

      <div
        ref={containerRef}
        className="overflow-x-hidden overflow-y-auto rounded-md [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 dark:[&::-webkit-scrollbar-track]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600"
        style={{ maxHeight: 600, scrollbarGutter: "stable" }}
      >
        <svg
          width={svgW}
          height={svgH}
          className="block"
        >
          {/* ─── Month gridlines + labels ─── */}
          {monthTicks.map(({ x, label }) => (
            <g key={`m-${label}`}>
              <line
                x1={x} y1={TOP} x2={x} y2={svgH - BOTTOM}
                stroke="#94a3b8"
                strokeWidth={0.7}
                strokeDasharray="4 3"
                strokeOpacity={0.55}
              />
              <text
                x={x + 3}
                y={TOP - 6}
                fontSize={9}
                fill="currentColor"
                className="fill-slate-500 dark:fill-slate-400"
              >
                {label}
              </text>
            </g>
          ))}

          {/* ─── Left separator ─── */}
          <line
            x1={LEFT} y1={TOP - 2} x2={LEFT} y2={svgH - BOTTOM}
            stroke="#94a3b8" strokeWidth={1} strokeOpacity={0.5}
          />

          {/* ─── Bottom axis ─── */}
          <line
            x1={LEFT} y1={svgH - BOTTOM} x2={svgW - RIGHT} y2={svgH - BOTTOM}
            stroke="#94a3b8" strokeWidth={1} strokeOpacity={0.5}
          />

          {/* ─── Rows ─── */}
          {ganttRows.map((row, i) => {
            const cy = TOP + i * ROW_H;
            const barCy = cy + (ROW_H - BAR_H) / 2;
            const visCy = cy + (ROW_H - VIS_H) / 2;
            const labelTrunc =
              (row.sourceName ?? `src${row.sourceId}`).length > 26
                ? (row.sourceName ?? `src${row.sourceId}`).slice(0, 24) + "…"
                : (row.sourceName ?? `src${row.sourceId}`);
            const pColor = PRIORITY_COLORS[row.sourcePriority ?? ""] ?? "#64748b";

            // Active weekly observations for this row
            const activeObs = row.weeklyExposure.filter((we) => activeWeeks.has(we.weekIndex));

            return (
              <g key={`${row.sourceId}-${row.sourceName ?? ""}-${i}`}>
                {/* Alternating row background stripe */}
                <rect
                  x={0} y={cy} width={svgW} height={ROW_H}
                  fill={i % 2 === 0 ? "transparent" : "currentColor"}
                  className={i % 2 === 0 ? "" : "fill-slate-50 dark:fill-slate-800/40"}
                  fillOpacity={1}
                />

                {/* Priority dot */}
                <circle cx={LEFT - 10} cy={cy + ROW_H / 2} r={3.5} fill={pColor} />

                {/* Source label */}
                <text
                  x={LEFT - 18}
                  y={cy + ROW_H / 2 + 4}
                  fontSize={9}
                  textAnchor="end"
                  fill="currentColor"
                  className="fill-slate-700 dark:fill-slate-300"
                >
                  {labelTrunc}
                </text>

                {/* Visibility window bands */}
                {row.visibleDateRanges
                  ? parseVisibilitySegments(row.visibleDateRanges).map(({ a, b }, vi) => {
                      const x0 = dateToX(a);
                      const x1 = dateToX(b);
                      const w = Math.max(1, x1 - x0);
                      if (x1 < LEFT || x0 > svgW - RIGHT) return null;
                      return (
                        <rect
                          key={`vis-${vi}`}
                          x={Math.max(LEFT, x0)}
                          y={visCy}
                          width={Math.min(w, svgW - RIGHT - Math.max(LEFT, x0))}
                          height={VIS_H}
                          fill={VIS_COLOR}
                          fillOpacity={0.5}
                          rx={1}
                        />
                      );
                    })
                  : null}

                {/* Scheduled observation bars */}
                {activeObs.map((we, wi) => {
                  const wb = weekBoundMap.get(we.weekIndex);
                  if (!wb?.startDate) return null;
                  const t0 = parseDate(wb.startDate);
                  const t1 = addDays(t0, 5);
                  const x0 = dateToX(t0);
                  const x1 = dateToX(t1);
                  const w = Math.max(4, x1 - x0);
                  if (x0 > svgW - RIGHT || x1 < LEFT) return null;
                  const expKs = we.exposureS / 1000;
                  const labelX = Math.min(x0 + w + 2, svgW - RIGHT - 18);
                  return (
                    <g key={`bar-${we.weekIndex}-${wi}`}>
                      <rect
                        x={x0}
                        y={barCy}
                        width={w}
                        height={BAR_H}
                        fill={BAR_COLOR}
                        fillOpacity={0.85}
                        stroke="#1a1a2e"
                        strokeWidth={0.4}
                        rx={1.5}
                      />
                      {w > 10 ? (
                        <text
                          x={labelX}
                          y={barCy + BAR_H / 2 + 3.5}
                          fontSize={7}
                          fill="currentColor"
                          className="fill-slate-700 dark:fill-slate-300"
                        >
                          {expKs.toFixed(1)}k
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-4 rounded-sm"
            style={{ backgroundColor: BAR_COLOR, opacity: 0.85 }}
          />
          Scheduled obs
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-4 rounded-sm"
            style={{ backgroundColor: VIS_COLOR, opacity: 0.6 }}
          />
          Visible window
        </span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#d62728]" />
          Priority A
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#1f77b4]" />
          Priority B
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2ca02c]" />
          Priority C
        </span>
        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
          {ganttRows.length} sources
        </span>
      </div>
    </div>
  );
}
