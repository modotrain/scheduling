"use client";

import { MouseEvent as ReactMouseEvent, ReactElement, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";

import { getCycleWeekLabel } from "@/app/lib/week-utils";

const SUN_THRESHOLD_A1 = 94.5;
const MOON_THRESHOLD_A1 = 10.0;
const DAY_MS = 86_400_000;

type VisitPreviewInput = {
  visitNo: number;
  start: string;
  end: string;
  weekId: string;
};

type VisitPreview = VisitPreviewInput & {
  midpoint: string;
  visible: boolean;
  sunAngle: number;
  moonAngle: number;
  dayKey: string;
};

type DaySample = {
  date: string;
  sunAngle: number;
  moonAngle: number;
  visible: boolean;
};

type VisibilityRange = {
  start: string;
  end: string;
};

type VisibilityState = {
  hasGeometry: boolean;
  daySeries: DaySample[];
  visibleRanges: VisibilityRange[];
  visitPreviews: VisitPreview[];
  blockedVisits: VisitPreview[];
};

type Props = {
  sourceRa: string | null;
  sourceDec: string | null;
  plannedStart: string;
  plannedEnd: string;
  visitPreviews: VisitPreviewInput[];
};

function toRad(degree: number): number {
  return (degree * Math.PI) / 180;
}

function toDeg(radian: number): number {
  return (radian * 180) / Math.PI;
}

function normalizeAngle(degree: number): number {
  const value = degree % 360;
  return value < 0 ? value + 360 : value;
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDaysToDateTime(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setTime(date.getTime() + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

function dateDiffDays(a: string, b: string): number {
  return (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS;
}

function midpointDate(start: string, end: string): string {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return new Date((startMs + endMs) / 2).toISOString().slice(0, 10);
}

function parseCoordinate(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function raDecFromGeoVector(body: Astronomy.Body, date: Date): { ra: number; dec: number } {
  const v = Astronomy.GeoVector(body, date, true);
  const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (r <= 0) {
    return { ra: 0, dec: 0 };
  }

  return {
    ra: normalizeAngle(toDeg(Math.atan2(v.y, v.x))),
    dec: toDeg(Math.asin(v.z / r)),
  };
}

function sunRaDec(date: Date): { ra: number; dec: number } {
  return raDecFromGeoVector(Astronomy.Body.Sun, date);
}

function moonRaDec(date: Date): { ra: number; dec: number } {
  return raDecFromGeoVector(Astronomy.Body.Moon, date);
}

function angularDistance(raA: number, decA: number, raB: number, decB: number): number {
  const sinDecA = Math.sin(toRad(decA));
  const sinDecB = Math.sin(toRad(decB));
  const cosDecA = Math.cos(toRad(decA));
  const cosDecB = Math.cos(toRad(decB));
  const deltaRa = toRad(raA - raB);
  const cosAngle = sinDecA * sinDecB + cosDecA * cosDecB * Math.cos(deltaRa);
  return toDeg(Math.acos(Math.min(1, Math.max(-1, cosAngle))));
}

function computeVisitWindows(
  plannedStart: string,
  plannedEnd: string,
  visitCount: number,
  cadenceValue: number,
  cadenceUnit: string,
): Array<{ start: string; end: string; weekStart: string }> {
  const cadenceDays =
    cadenceValue > 0
      ? cadenceUnit === "orbit"
        ? (cadenceValue * 97 * 60) / 86_400
        : cadenceValue
      : 0;

  const safeEnd = plannedEnd || addDays(plannedStart, 7);
  const rangeDays = dateDiffDays(plannedStart, safeEnd);

  let visitsInFirstWeek = 1;
  if (cadenceDays > 0 && cadenceDays < 7) {
    visitsInFirstWeek = Math.max(1, Math.ceil((rangeDays - 1) / cadenceDays));
  }

  const firstStart = plannedStart;
  let firstEnd = addDaysToDateTime(safeEnd, -(cadenceDays * (visitsInFirstWeek - 1)));
  if (dateDiffDays(firstStart, firstEnd) < 1) {
    firstEnd = addDays(firstStart, 1);
  }

  const actualDurationDays = dateDiffDays(firstStart, firstEnd);
  const time1 = addDaysToDateTime(firstStart, Math.floor(actualDurationDays / 3));

  return Array.from({ length: visitCount }, (_value, index) => {
    const shiftedStart = addDaysToDateTime(firstStart, cadenceDays * index);
    const shiftedEnd = addDaysToDateTime(firstEnd, cadenceDays * index);
    const dayMidpoint = addDaysToDateTime(time1, cadenceDays * index);
    const weekStart = dayMidpoint;
    return { start: shiftedStart, end: shiftedEnd, weekStart };
  });
}

export function buildGpPlanVisitPreviews(
  plannedStart: string,
  plannedEnd: string,
  visitCount: number,
  cadenceValue: number,
  cadenceUnit: string,
): VisitPreviewInput[] {
  if (!plannedStart || visitCount < 1) return [];

  const count = Math.min(visitCount, 52);
  return computeVisitWindows(plannedStart, plannedEnd, count, cadenceValue, cadenceUnit).map((window, index) => ({
    visitNo: index + 1,
    start: window.start,
    end: window.end,
    weekId: getCycleWeekLabel(window.weekStart),
  }));
}

export function evaluateGpVisibility({
  sourceRa,
  sourceDec,
  plannedStart,
  plannedEnd,
  visitPreviews,
}: {
  sourceRa: string | null;
  sourceDec: string | null;
  plannedStart: string;
  plannedEnd: string;
  visitPreviews: VisitPreviewInput[];
}): VisibilityState {
  const sourceRaDeg = parseCoordinate(sourceRa);
  const sourceDecDeg = parseCoordinate(sourceDec);
  if (!plannedStart || sourceRaDeg === null || sourceDecDeg === null) {
    return { hasGeometry: false, daySeries: [], visibleRanges: [], visitPreviews: [], blockedVisits: [] };
  }

  const visits = visitPreviews.map((visit) => {
    const midpoint = midpointDate(visit.start, visit.end);
    const day = new Date(`${midpoint}T00:00:00Z`);
    const sun = sunRaDec(day);
    const moon = moonRaDec(day);
    const sunAngle = angularDistance(sourceRaDeg, sourceDecDeg, sun.ra, sun.dec);
    const moonAngle = angularDistance(sourceRaDeg, sourceDecDeg, moon.ra, moon.dec);
    const visible = sunAngle >= SUN_THRESHOLD_A1 && moonAngle >= MOON_THRESHOLD_A1;
    return {
      ...visit,
      midpoint,
      visible,
      sunAngle,
      moonAngle,
      dayKey: midpoint,
    };
  });

  const chartEnd = visits.reduce((latest, visit) => {
    return visit.end > latest ? visit.end : latest;
  }, plannedEnd || plannedStart);
  // +1 so the end date itself is included as a data point (e.g. May 12–14 → 3 pts)
  const totalDays = Math.max(1, Math.ceil(dateDiffDays(plannedStart, chartEnd)) + 1);

  const daySeries: DaySample[] = Array.from({ length: totalDays }, (_value, index) => {
    const date = addDays(plannedStart, index);
    const day = new Date(`${date}T00:00:00Z`);
    const sun = sunRaDec(day);
    const moon = moonRaDec(day);
    const sunAngle = angularDistance(sourceRaDeg, sourceDecDeg, sun.ra, sun.dec);
    const moonAngle = angularDistance(sourceRaDeg, sourceDecDeg, moon.ra, moon.dec);
    return {
      date,
      sunAngle,
      moonAngle,
      visible: sunAngle >= SUN_THRESHOLD_A1 && moonAngle >= MOON_THRESHOLD_A1,
    };
  });

  const visibleRanges: VisibilityRange[] = [];
  let activeStart: string | null = null;
  for (const day of daySeries) {
    if (day.visible && !activeStart) {
      activeStart = day.date;
    }
    if (!day.visible && activeStart) {
      visibleRanges.push({ start: activeStart, end: day.date });
      activeStart = null;
    }
  }
  if (activeStart) {
    visibleRanges.push({ start: activeStart, end: addDays(daySeries[daySeries.length - 1]?.date ?? plannedStart, 1) });
  }

  const dayLookup = new Map(daySeries.map((day) => [day.date, day]));
  const resolvedVisits = visits.map((visit) => {
    const day = dayLookup.get(visit.dayKey) ?? null;
    return {
      ...visit,
      visible: day ? day.visible : visit.visible,
      sunAngle: day ? day.sunAngle : visit.sunAngle,
      moonAngle: day ? day.moonAngle : visit.moonAngle,
    };
  });

  const blockedVisits = resolvedVisits.filter((visit) => !visit.visible);
  return {
    hasGeometry: true,
    daySeries,
    visibleRanges,
    visitPreviews: resolvedVisits,
    blockedVisits,
  };
}

export default function GpPlanVisibilityReferenceChart({
  sourceRa,
  sourceDec,
  plannedStart,
  plannedEnd,
  visitPreviews,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const state = useMemo(
    () => evaluateGpVisibility({ sourceRa, sourceDec, plannedStart, plannedEnd, visitPreviews }),
    [plannedEnd, plannedStart, sourceDec, sourceRa, visitPreviews],
  );

  const width = 980;
  const height = 208;
  const padding = { top: 12, right: 16, bottom: 34, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const bgColor = "var(--chart-bg)";
  const maskColor = "var(--chart-mask)";
  const darkText = "var(--axis-text)";
  const gridColor = "var(--grid-color)";
  const sunColor = "var(--sun-color)";
  const moonColor = "var(--moon-color)";
  const pointRadius = state.daySeries.length > 60 ? 2.2 : state.daySeries.length > 28 ? 2.6 : 2.9;

  const maxAngle = 180;
  const minAngle = 0;

  const xForIndex = (index: number): number => {
    const denominator = Math.max(1, state.daySeries.length - 1);
    return padding.left + (index / denominator) * chartWidth;
  };

  const yForAngle = (angle: number): number => {
    const clamped = Math.min(maxAngle, Math.max(minAngle, angle));
    return padding.top + chartHeight - ((clamped - minAngle) / (maxAngle - minAngle)) * chartHeight;
  };

  const xForDate = (date: string, fallbackToRight = false): number => {
    const index = state.daySeries.findIndex((day) => day.date === date);
    if (index >= 0) return xForIndex(index);
    return fallbackToRight ? padding.left + chartWidth : padding.left;
  };

  const dayBoundsForIndex = (index: number): { left: number; right: number } => {
    const x = xForIndex(index);
    const prev = index > 0 ? xForIndex(index - 1) : x;
    const next = index < state.daySeries.length - 1 ? xForIndex(index + 1) : x;
    const left = index === 0 ? padding.left : (prev + x) / 2;
    const right = index === state.daySeries.length - 1 ? padding.left + chartWidth : (x + next) / 2;
    return { left, right };
  };

  const segmentBoundsForIndex = (index: number): { left: number; right: number } => {
    if (state.daySeries.length <= 1) {
      return { left: padding.left, right: padding.left + chartWidth };
    }
    const left = xForIndex(index);
    const right = xForIndex(Math.min(index + 1, state.daySeries.length - 1));
    return { left, right };
  };

  // Segment-level rule (UTC midnight to UTC midnight):
  // if day i is invisible at 00:00, block [i-1, i) and [i, i+1).
  // Equivalent: segment j is blocked when day j or day j+1 is invisible.
  const segmentFlags = state.daySeries.length > 1
    ? Array.from({ length: state.daySeries.length - 1 }, (_value, i) => {
        const leftDay = state.daySeries[i]!;
        const rightDay = state.daySeries[i + 1]!;
        return {
          index: i,
          blocked: !leftDay.visible || !rightDay.visible,
        };
      })
    : [];

  const visibleRects = segmentFlags.flatMap((segment) => {
    if (segment.blocked) return [];
    const { left, right } = segmentBoundsForIndex(segment.index);
    return (
      <rect
        key={`visible-segment-${segment.index}`}
        x={left}
        y={padding.top}
        width={Math.max(1.2, right - left)}
        height={chartHeight}
        fill="#16a34a"
        opacity="0.12"
      />
    );
  });

  const invisibleDayOverlays = segmentFlags.flatMap((segment) => {
    if (!segment.blocked) return [];
    const { left, right } = segmentBoundsForIndex(segment.index);
    const widthPx = Math.max(1.2, right - left);
    const x = left;
    return (
      <g key={`blocked-segment-${segment.index}`}>
        <rect
          x={x}
          y={padding.top}
          width={widthPx}
          height={chartHeight}
          fill={maskColor}
          opacity="1"
        />
      </g>
    );
  });

  const breakBoundaryLines: ReactElement[] = [];
  if (segmentFlags.length > 1) {
    for (let i = 0; i < segmentFlags.length - 1; i += 1) {
      const left = segmentFlags[i]!;
      const right = segmentFlags[i + 1]!;
      if (left.blocked === right.blocked) continue;
      breakBoundaryLines.push(
        <line
          key={`break-boundary-${i + 1}`}
          x1={xForIndex(i + 1)}
          y1={padding.top}
          x2={xForIndex(i + 1)}
          y2={padding.top + chartHeight}
          stroke="var(--breakline-color)"
          strokeWidth="0.8"
          opacity="0.42"
        />,
      );
    }
  }

  const gridAngles = [180, 135, 90, 45, 0];
  const gridLines = gridAngles.map((angle) => {
    const y = yForAngle(angle);
    return (
      <g key={`grid-${angle}`}>
        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={gridColor} strokeWidth="0.75" opacity="0.7" />
        <text x={padding.left - 6} y={y + 3.5} fontSize="10" fill={darkText} textAnchor="end" opacity="0.92">
          {angle.toFixed(0)}°
        </text>
      </g>
    );
  });

  const sunPath = state.daySeries.map((day, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForAngle(day.sunAngle)}`).join(" ");
  const moonPath = state.daySeries.map((day, index) => `${index === 0 ? "M" : "L"} ${xForIndex(index)} ${yForAngle(day.moonAngle)}`).join(" ");

  // Visible visit rects — rendered BEFORE masks so they are covered in blocked regions (correct).
  const visitBandVisibleRects = state.visitPreviews
    .filter((v) => v.visible)
    .map((visit) => {
      const left = xForDate(visit.start, false);
      const right = xForDate(visit.end, true);
      const bandWidth = Math.max(2, right - left);
      return (
        <rect
          key={`visit-rect-${visit.visitNo}`}
          x={left}
          y={padding.top}
          width={bandWidth}
          height={chartHeight}
          fill="var(--visit-band-fill)"
          opacity="0.16"
          stroke="var(--visit-band-stroke)"
          strokeOpacity="0.28"
          strokeWidth="0.8"
        />
      );
    });

  // Blocked visit rects — rendered AFTER masks so the red tint shows on top of the mask.
  const visitBandBlockedRects = state.visitPreviews
    .filter((v) => !v.visible)
    .map((visit) => {
      const left = xForDate(visit.start, false);
      const right = xForDate(visit.end, true);
      const bandWidth = Math.max(2, right - left);
      return (
        <rect
          key={`visit-rect-${visit.visitNo}`}
          x={left}
          y={padding.top}
          width={bandWidth}
          height={chartHeight}
          fill="var(--blocked-band-fill)"
          opacity="0.22"
          stroke="var(--blocked-band-stroke)"
          strokeOpacity="0.45"
          strokeWidth="0.8"
        />
      );
    });

  // Labels rendered AFTER the invisible masks so they are always readable.
  const visitBandLabels = state.visitPreviews.map((visit) => {
    const left = xForDate(visit.start, false);
    const right = xForDate(visit.end, true);
    const bandWidth = Math.max(2, right - left);
    const centerX = left + bandWidth / 2;
    const textColor = visit.visible ? "var(--visit-band-text)" : "var(--blocked-band-text)";
    return (
      <text key={`visit-label-${visit.visitNo}`} x={centerX} y={padding.top + 11} textAnchor="middle" fontSize="12" fill={textColor} fontWeight="700">
        V{visit.visitNo}
      </text>
    );
  });

  const dateLabels = state.daySeries.length > 0
    ? [
        0,
        Math.floor((state.daySeries.length - 1) * 0.33),
        Math.floor((state.daySeries.length - 1) * 0.66),
        state.daySeries.length - 1,
      ]
        .filter((value, index, array) => array.indexOf(value) === index)
        .map((index) => {
          const day = state.daySeries[index]!;
          const x = xForIndex(index);
          const shortDate = day.date.slice(5);
          return (
            <text
              key={`date-${day.date}`}
              x={x}
              y={height - 12}
              textAnchor={index === 0 ? "start" : index === state.daySeries.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill={darkText}
            >
              {shortDate}
            </text>
          );
        })
    : null;

  const handleChartMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (state.daySeries.length === 0) {
      setHoverIndex(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setHoverIndex(null);
      return;
    }

    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const svgY = ((event.clientY - rect.top) / rect.height) * height;

    if (
      svgX < padding.left ||
      svgX > width - padding.right ||
      svgY < padding.top ||
      svgY > padding.top + chartHeight
    ) {
      setHoverIndex(null);
      return;
    }

    const denominator = Math.max(1, state.daySeries.length - 1);
    const normalized = (svgX - padding.left) / chartWidth;
    const candidate = Math.round(normalized * denominator);
    const clamped = Math.min(Math.max(0, candidate), state.daySeries.length - 1);
    setHoverIndex(clamped);
  };

  const hoverDay = hoverIndex !== null ? (state.daySeries[hoverIndex] ?? null) : null;
  const hoverX = hoverIndex !== null ? xForIndex(hoverIndex) : null;

  if (!state.hasGeometry) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Visibility Reference</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Enter a start date, source coordinates, and visit count to preview visibility.
            </p>
          </div>
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Sun &gt;= {SUN_THRESHOLD_A1}°, Moon &gt;= {MOON_THRESHOLD_A1}°
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40 [--chart-bg:#f8fafc] [--chart-mask:#f8fafc] [--axis-text:#334155] [--grid-color:#cbd5e1] [--sun-color:#b91c1c] [--moon-color:#0056b3] [--visit-band-fill:#16a34a] [--visit-band-stroke:#166534] [--visit-band-text:#14532d] [--blocked-band-fill:#ef4444] [--blocked-band-stroke:#7f1d1d] [--blocked-band-text:#991b1b] [--breakline-color:#94a3b8] [--tooltip-bg:#ffffff] [--tooltip-border:#cbd5e1] [--tooltip-title:#0f172a] [--tooltip-sun:#991b1b] [--tooltip-moon:#1d4ed8] dark:[--chart-bg:#0b1220] dark:[--chart-mask:#0b1220] dark:[--axis-text:#cbd5e1] dark:[--grid-color:#334155] dark:[--sun-color:#fca5a5] dark:[--moon-color:#93c5fd] dark:[--visit-band-fill:#22c55e] dark:[--visit-band-stroke:#4ade80] dark:[--visit-band-text:#bbf7d0] dark:[--blocked-band-fill:#fb7185] dark:[--blocked-band-stroke:#fda4af] dark:[--blocked-band-text:#fecdd3] dark:[--breakline-color:#64748b] dark:[--tooltip-bg:#0f172a] dark:[--tooltip-border:#334155] dark:[--tooltip-title:#e2e8f0] dark:[--tooltip-sun:#fecaca] dark:[--tooltip-moon:#bfdbfe]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Visibility Reference</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Green bands indicate daily visibility windows. Visit markers are colored by the constraint check.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Sun &gt;= {SUN_THRESHOLD_A1}°, Moon &gt;= {MOON_THRESHOLD_A1}°
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          onMouseMove={handleChartMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <rect x={0} y={0} width={width} height={height} fill={bgColor} />
          {visibleRects}
          {visitBandVisibleRects}
          {invisibleDayOverlays}
          {visitBandBlockedRects}
          {gridLines}
          {breakBoundaryLines}

          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke={darkText} strokeWidth="1" opacity="0.6" />
          <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} stroke={darkText} strokeWidth="1" opacity="0.6" />

          <path d={sunPath} fill="none" stroke={sunColor} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
          <path d={moonPath} fill="none" stroke={moonColor} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />

          {state.daySeries.map((day, index) => {
            const x = xForIndex(index);
            const ySun = yForAngle(day.sunAngle);
            const yMoon = yForAngle(day.moonAngle);
            return (
              <g key={day.date}>
                <circle cx={x} cy={ySun} r={pointRadius} fill={sunColor} stroke="#fff" strokeWidth="0.9" />
                <circle cx={x} cy={yMoon} r={pointRadius} fill={moonColor} stroke="#fff" strokeWidth="0.9" />
              </g>
            );
          })}

          {hoverDay && hoverX !== null ? (
            <g pointerEvents="none">
              <line
                x1={hoverX}
                y1={padding.top}
                x2={hoverX}
                y2={padding.top + chartHeight}
                stroke="#334155"
                strokeWidth="0.9"
                strokeDasharray="3 3"
                opacity="0.45"
              />
              {(() => {
                const tooltipWidth = 176;
                const tooltipHeight = 48;
                const tooltipX = Math.min(
                  width - padding.right - tooltipWidth - 2,
                  Math.max(padding.left + 2, hoverX + 10),
                );
                const tooltipY = padding.top + 4;
                return (
                  <g>
                    <rect
                      x={tooltipX}
                      y={tooltipY}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx="6"
                      fill="var(--tooltip-bg)"
                      stroke="var(--tooltip-border)"
                      strokeWidth="1"
                    />
                    <text x={tooltipX + 8} y={tooltipY + 14} fill="var(--tooltip-title)" fontSize="10" fontWeight="600">
                      {hoverDay.date}
                    </text>
                    <text x={tooltipX + 8} y={tooltipY + 28} fill="var(--tooltip-sun)" fontSize="10">
                      Sun: {hoverDay.sunAngle.toFixed(2)}°
                    </text>
                    <text x={tooltipX + 8} y={tooltipY + 41} fill="var(--tooltip-moon)" fontSize="10">
                      Moon: {hoverDay.moonAngle.toFixed(2)}°
                    </text>
                  </g>
                );
              })()}
            </g>
          ) : null}

          {dateLabels}
          {visitBandLabels}
        </svg>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-3 w-8 rounded-sm bg-emerald-500/20 ring-1 ring-emerald-500/30" />
          <span>Visible window</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-8 rounded bg-[color:var(--sun-color,#b91c1c)]" style={{ backgroundColor: sunColor }} />
          <span>Sun aspect angle</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-8 rounded bg-[color:var(--moon-color,#0056b3)]" style={{ backgroundColor: moonColor }} />
          <span>Moon aspect angle</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Schedulable
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            Unschedulable
          </span>
        </div>
      </div>
    </div>
  );
}