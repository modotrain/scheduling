"use client";

import { useMemo } from "react";

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

function julianDay(date: Date): number {
  return date.getTime() / DAY_MS + 2440587.5;
}

function sunRaDec(date: Date): { ra: number; dec: number } {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;

  const L0 = normalizeAngle(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = normalizeAngle(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const omega = 125.04 - 1934.136 * T;

  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(toRad(M)) +
    (0.019993 - 0.000101 * T) * Math.sin(toRad(2 * M)) +
    0.000289 * Math.sin(toRad(3 * M));

  const trueLong = L0 + C;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  const eps0 =
    23 +
    (26 +
      (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) /
      60;
  const eps = eps0 + 0.00256 * Math.cos(toRad(omega));

  const x = Math.cos(toRad(lambda));
  const y = Math.cos(toRad(eps)) * Math.sin(toRad(lambda));
  const z = Math.sin(toRad(eps)) * Math.sin(toRad(lambda));

  return {
    ra: normalizeAngle(toDeg(Math.atan2(y, x))),
    dec: toDeg(Math.asin(z)),
  };
}

function moonRaDec(date: Date): { ra: number; dec: number } {
  const jd = julianDay(date);
  const d = jd - 2451545.0;

  const L = normalizeAngle(218.316 + 13.176396 * d);
  const Mm = normalizeAngle(134.963 + 13.064993 * d);
  const D = normalizeAngle(297.850 + 12.190749 * d);
  const F = normalizeAngle(93.272 + 13.229350 * d);

  const lon =
    L +
    6.289 * Math.sin(toRad(Mm)) +
    1.274 * Math.sin(toRad(2 * D - Mm)) +
    0.658 * Math.sin(toRad(2 * D)) +
    0.214 * Math.sin(toRad(2 * Mm)) +
    0.11 * Math.sin(toRad(D));

  const lat =
    5.128 * Math.sin(toRad(F)) +
    0.280 * Math.sin(toRad(Mm + F)) +
    0.277 * Math.sin(toRad(Mm - F)) +
    0.173 * Math.sin(toRad(2 * D - F));

  const eps = 23.439291 - 0.0130042 * (d / 36525);
  const x = Math.cos(toRad(lon)) * Math.cos(toRad(lat));
  const y = Math.sin(toRad(lon)) * Math.cos(toRad(lat));
  const z = Math.sin(toRad(lat));

  const ye = y * Math.cos(toRad(eps)) - z * Math.sin(toRad(eps));
  const ze = y * Math.sin(toRad(eps)) + z * Math.cos(toRad(eps));

  return {
    ra: normalizeAngle(toDeg(Math.atan2(ye, x))),
    dec: toDeg(Math.asin(ze)),
  };
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
  const totalDays = Math.max(1, Math.ceil(dateDiffDays(plannedStart, chartEnd)));

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
  const state = useMemo(
    () => evaluateGpVisibility({ sourceRa, sourceDec, plannedStart, plannedEnd, visitPreviews }),
    [plannedEnd, plannedStart, sourceDec, sourceRa, visitPreviews],
  );

  const width = 980;
  const height = 208;
  const padding = { top: 12, right: 16, bottom: 34, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const bgColor = "#f8fafc";
  const darkText = "#334155";
  const gridColor = "#cbd5e1";
  const sunColor = "#b91c1c";
  const moonColor = "#0056b3";
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

  const visibleRects = state.visibleRanges.map((range, index) => {
    const startIndex = state.daySeries.findIndex((day) => day.date === range.start);
    const endIndex = state.daySeries.findIndex((day) => day.date === range.end);
    const left = startIndex >= 0 ? xForIndex(startIndex) : padding.left;
    const right = endIndex >= 0 ? xForIndex(endIndex) : padding.left + chartWidth;
    return (
      <rect
        key={`${range.start}-${range.end}-${index}`}
        x={left}
        y={padding.top}
        width={Math.max(2, right - left)}
        height={chartHeight}
        fill="#16a34a"
        opacity="0.12"
      />
    );
  });

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

  const visitMarkers = state.visitPreviews.map((visit) => {
    const index = Math.min(
      Math.max(0, state.daySeries.findIndex((day) => day.date === visit.dayKey)),
      Math.max(0, state.daySeries.length - 1),
    );
    const x = xForIndex(index);
    const y = padding.top + chartHeight - 12;
    const tone = visit.visible
      ? { fill: "#16a34a", stroke: "#14532d" }
      : { fill: "#ef4444", stroke: "#7f1d1d" };

    return (
      <g key={`visit-${visit.visitNo}`}>
        <line x1={x} y1={padding.top + chartHeight} x2={x} y2={y} stroke={tone.fill} strokeWidth="1.8" opacity="0.8" />
        <circle cx={x} cy={y} r="5" fill={tone.fill} stroke={tone.stroke} strokeWidth="1.5" />
        <text x={x} y={y - 9} textAnchor="middle" fontSize="12" fill={tone.fill} fontWeight="700">
          V{visit.visitNo}
        </text>
      </g>
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Visibility Reference</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Green bands indicate daily visibility windows. Visit markers are colored by the same constraint check used for saving.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Sun &gt;= {SUN_THRESHOLD_A1}°, Moon &gt;= {MOON_THRESHOLD_A1}°
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block w-full">
          <rect x={0} y={0} width={width} height={height} fill={bgColor} />
          {visibleRects}
          {gridLines}

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

          {visitMarkers}
          {dateLabels}
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
            V marker = visible
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            blocked = outside window
          </span>
        </div>
      </div>
    </div>
  );
}