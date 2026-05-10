"use client";

import { geoGraticule, geoPath } from "d3-geo";
import { geoMollweide } from "d3-geo-projection";
import { useCallback, useEffect, useMemo, useState } from "react";

type SkyPoint = {
  sourceId: number;
  sourceName: string | null;
  proposalNo: string | null;
  pi: string | null;
  obsType: string | null;
  sourcePriority: string | null;
  ra: number;
  dec: number;
  totalExposureTimeAll: number;
  totalExposureKs: number;
  pointSize: number;
  nScheduled: number;
  minWeek: number | null;
  maxWeek: number | null;
  scheduledDateStart: string | null;
  scheduledDateEnd: string | null;
  weeklyExposure: Array<{ weekIndex: number; exposureS: number }>;
};

type SkyRegion = {
  iRa: number;
  iDec: number;
  raLo: number;
  raHi: number;
  decLo: number;
  decHi: number;
  totalExposureKs: number;
  alpha: number;
  nSources: number;
};

type SkyPayload = {
  points: SkyPoint[];
  regions: SkyRegion[];
  weekBounds: Array<{ weekIndex: number; startDate: string | null; endDate: string | null }>;
  summary: {
    totalSources: number;
    totalExposureS: number;
    totalExposureMillionS: number;
    priorities: { A: number; B: number; C: number };
  };
};

type HoverState = {
  point: SkyPoint;
  x: number;
  y: number;
};

const PRIORITY_COLORS: Record<string, string> = {
  A: "#d62728",
  B: "#1f77b4",
  C: "#2ca02c",
};

function toMollweideLon(ra: number): number {
  return ((ra + 180) % 360) - 180;
}

function buildPopupText(point: SkyPoint): string {
  const scheduledDateStart = point.scheduledDateStart ?? "-";
  const scheduledDateEnd = point.scheduledDateEnd ?? "-";
  return [
    `Source: ${point.sourceName ?? "Unknown Source"}`,
    `Source ID: ${point.sourceId}`,
    `Proposal: ${point.proposalNo ?? "-"}`,
    `PI: ${point.pi ?? "-"}`,
    `Obs Type: ${point.obsType ?? "-"}`,
    `Priority: ${point.sourcePriority ?? "-"}`,
    `RA/Dec: ${point.ra.toFixed(4)} / ${point.dec.toFixed(4)}`,
    `Exposure: ${point.totalExposureTimeAll.toLocaleString()} s`,
    `Scheduled Visits: ${point.nScheduled}`,
    `Scheduled Week Range: ${point.minWeek ?? "-"} to ${point.maxWeek ?? "-"}`,
    `Scheduled Date Range: ${scheduledDateStart} to ${scheduledDateEnd}`,
  ].join("\n");
}

export default function Cycle2SkyMap() {
  const [data, setData] = useState<SkyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [lockedHover, setLockedHover] = useState<HoverState | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekRangeStart, setWeekRangeStart] = useState(1);
  const [weekRangeEnd, setWeekRangeEnd] = useState(52);
  const [activeHandle, setActiveHandle] = useState<"start" | "end" | null>(null);

  const width = 1300;
  const height = 740;
  const margin = 24;

  const projection = useMemo(() => {
    const p = geoMollweide();
    p.fitExtent(
      [
        [margin, margin],
        [width - margin, height - margin],
      ],
      { type: "Sphere" },
    );
    return p;
  }, []);

  const pathBuilder = useMemo(() => geoPath(projection), [projection]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/cycle2-long-term/skymap", { cache: "no-store" });
        const payload = (await response.json()) as SkyPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load sky map data");
        }
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sky map");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const graticulePath = useMemo(() => {
    const graticule = geoGraticule().step([30, 30])();
    return pathBuilder(graticule) ?? "";
  }, [pathBuilder]);

  const pointMarks = useMemo(
    () =>
      data?.points
        .map((point) => {
          const projected = projection([toMollweideLon(point.ra), point.dec]);
          if (!projected) return null;
          const [x, y] = projected;
          const color = PRIORITY_COLORS[point.sourcePriority ?? ""] ?? "#111827";
          return { point, x, y, color };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) ?? [],
    [data, projection],
  );

  const weekMin = useMemo(() => {
    if (!data?.weekBounds?.length) return 1;
    return Math.min(...data.weekBounds.map((item) => item.weekIndex));
  }, [data]);

  const weekMax = useMemo(() => {
    if (!data?.weekBounds?.length) return 52;
    return Math.max(...data.weekBounds.map((item) => item.weekIndex));
  }, [data]);

  const weekSpan = Math.max(1, weekMax - weekMin);

  const weekBoundMap = useMemo(() => {
    return new Map((data?.weekBounds ?? []).map((item) => [item.weekIndex, item]));
  }, [data]);

  useEffect(() => {
    setWeekRangeStart(weekMin);
    setWeekRangeEnd(weekMax);
  }, [weekMin, weekMax]);

  const computeExposureSInActiveRange = useCallback((point: SkyPoint): number => {
    if (filterMode === "single" && selectedWeek !== null) {
      return point.weeklyExposure
        .filter((item) => item.weekIndex === selectedWeek)
        .reduce((sum, item) => sum + item.exposureS, 0);
    }

    if (filterMode === "range") {
      return point.weeklyExposure
        .filter((item) => item.weekIndex >= weekRangeStart && item.weekIndex <= weekRangeEnd)
        .reduce((sum, item) => sum + item.exposureS, 0);
    }

    return point.totalExposureTimeAll;
  }, [filterMode, selectedWeek, weekRangeStart, weekRangeEnd]);

  const displayedPoints = useMemo(() => {
    return pointMarks
      .map((item) => {
        const activeExposureS = computeExposureSInActiveRange(item.point);
        const exposureClipped = Math.max(activeExposureS, 1);
        const scaledPointSize = 20 + Math.sqrt(exposureClipped) * 1.5;
        const radius = Math.max(2.75, Math.min(12.5, Math.sqrt(scaledPointSize) * 0.6));
        return {
          ...item,
          radius,
          activeExposureKs: activeExposureS / 1000,
          activeExposureS,
        };
      })
      .filter((item) => {
        if (filterMode === "single" && selectedWeek !== null) {
          return item.activeExposureS > 0;
        }
        if (filterMode === "range") {
          return item.activeExposureS > 0;
        }
        return true;
      });
  }, [pointMarks, filterMode, selectedWeek, computeExposureSInActiveRange]);

  const activeSummary = useMemo(() => {
    const priorities = { A: 0, B: 0, C: 0 };
    let totalExposureS = 0;

    for (const item of displayedPoints) {
      totalExposureS += item.activeExposureS;
      if (item.point.sourcePriority === "A") priorities.A += 1;
      else if (item.point.sourcePriority === "B") priorities.B += 1;
      else if (item.point.sourcePriority === "C") priorities.C += 1;
    }

    return {
      totalSources: displayedPoints.length,
      totalExposureMillionS: totalExposureS / 1_000_000,
      priorities,
    };
  }, [displayedPoints]);

  const raTickMarks = useMemo(
    () =>
      [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]
        .map((lon) => {
          const tick = projection([lon, 0]);
          if (!tick) return null;
          const [x, y] = tick;
          const raLabel = ((lon + 360) % 360).toString();
          return { lon, x, y, raLabel };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [projection],
  );

  const activePopup = lockedHover ?? hover;
  const isPopupLocked = lockedHover !== null;

  const copyText = useCallback(async (text: string, token: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
    } catch {
      setCopiedToken(null);
    }
  }, []);

  useEffect(() => {
    if (!copiedToken) return;
    const timeoutId = window.setTimeout(() => setCopiedToken(null), 1300);
    return () => window.clearTimeout(timeoutId);
  }, [copiedToken]);

  const clearPopupLock = useCallback(() => {
    setLockedHover(null);
    setHover(null);
  }, []);

  const startPercent = ((weekRangeStart - weekMin) / weekSpan) * 100;
  const endPercent = ((weekRangeEnd - weekMin) / weekSpan) * 100;

  const startWeekDateText = weekBoundMap.get(weekRangeStart)?.startDate ?? "-";
  const endWeekDateText = weekBoundMap.get(weekRangeEnd)?.endDate ?? "-";

  const startBubbleLeftPercent = Math.min(92, Math.max(8, startPercent));
  const endBubbleLeftPercent = Math.min(92, Math.max(8, endPercent));
  const handlesOverlapped = weekRangeStart === weekRangeEnd;
  const preferStartHandleTop = handlesOverlapped && weekRangeStart === weekMax;
  const preferEndHandleTop = handlesOverlapped && weekRangeStart === weekMin;

  if (loading) {
    return (
      <div className="rounded-lg ring-1 ring-slate-200 bg-white p-6 dark:ring-slate-700 dark:bg-slate-900">
        <div className="flex justify-center">
          <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg ring-1 ring-slate-200 bg-white p-6 text-sm text-rose-600 dark:ring-slate-700 dark:bg-slate-900 dark:text-rose-300">
        {error ?? "No sky map data available"}
      </div>
    );
  }

  return (
    <div
      className="relative rounded-lg ring-1 ring-slate-200 bg-white p-4 dark:ring-slate-700 dark:bg-slate-900"
      onClick={() => {
        if (isPopupLocked) {
          clearPopupLock();
        }
      }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>
            Sources: <span className="font-mono font-semibold">{activeSummary.totalSources}</span>
          </span>
          <span>
            Exposure: <span className="font-mono font-semibold">{activeSummary.totalExposureMillionS.toFixed(2)}M s</span>
          </span>
          <span>
            Priority A/B/C: <span className="font-mono font-semibold">{activeSummary.priorities.A}/{activeSummary.priorities.B}/{activeSummary.priorities.C}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          <label htmlFor="week-filter" className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Week
          </label>
          <input
            id="week-filter"
            type="number"
            min={weekMin}
            max={weekMax}
            placeholder={filterMode === "range" ? "week" : "week"}
            value={selectedWeek ?? ""}
            onChange={(e) => {
              const rawValue = e.target.value;
              if (!rawValue) {
                setFilterMode("single");
                setSelectedWeek(null);
                return;
              }
              const parsed = Number.parseInt(rawValue, 10);
              if (!Number.isFinite(parsed)) return;
              const clamped = Math.max(weekMin, Math.min(weekMax, parsed));
              setFilterMode("single");
              setSelectedWeek(clamped);
              setWeekRangeStart(clamped);
              setWeekRangeEnd(clamped);
            }}
            className="w-16 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          />
          <span
            aria-hidden={filterMode !== "range"}
            className={`rounded border border-sky-300 bg-sky-100 px-1 py-0.5 text-[10px] text-sky-700 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300 ${filterMode === "range" ? "visible" : "invisible"}`}
          >
            manual range
          </span>

          <div className="relative ml-1 w-[28rem] py-1.5">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700/90" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#0b4f8a] dark:bg-sky-300"
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
              }}
            />
            <input
              type="range"
              min={weekMin}
              max={weekMax}
              value={weekRangeStart}
              onPointerDown={() => setActiveHandle("start")}
              onPointerUp={() => setActiveHandle(null)}
              onMouseDown={() => setActiveHandle("start")}
              onTouchStart={() => setActiveHandle("start")}
              onMouseUp={() => setActiveHandle(null)}
              onTouchEnd={() => setActiveHandle(null)}
              onFocus={() => setActiveHandle("start")}
              onBlur={() => setActiveHandle(null)}
              onChange={(e) => {
                const nextStart = Math.min(Number.parseInt(e.target.value, 10), weekRangeEnd);
                setFilterMode("range");
                setWeekRangeStart(nextStart);
              }}
              className={`pointer-events-none absolute inset-0 h-7 w-full appearance-none bg-transparent ${activeHandle === "start" ? "z-40" : preferStartHandleTop ? "z-[35]" : "z-20"} [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-12px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0b4f8a] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.16)] dark:hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.22)] dark:[&::-webkit-slider-thumb]:border-sky-300 dark:[&::-webkit-slider-thumb]:bg-slate-900 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#0b4f8a] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:transition-shadow [&::-moz-range-thumb]:duration-150 hover:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.16)] dark:hover:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.22)] dark:[&::-moz-range-thumb]:border-sky-300 dark:[&::-moz-range-thumb]:bg-slate-900 ${activeHandle === "start" ? "[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.24)] dark:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.3)] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.24)] dark:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.3)]" : ""}`}
            />
            <input
              type="range"
              min={weekMin}
              max={weekMax}
              value={weekRangeEnd}
              onPointerDown={() => setActiveHandle("end")}
              onPointerUp={() => setActiveHandle(null)}
              onMouseDown={() => setActiveHandle("end")}
              onTouchStart={() => setActiveHandle("end")}
              onMouseUp={() => setActiveHandle(null)}
              onTouchEnd={() => setActiveHandle(null)}
              onFocus={() => setActiveHandle("end")}
              onBlur={() => setActiveHandle(null)}
              onChange={(e) => {
                const nextEnd = Math.max(Number.parseInt(e.target.value, 10), weekRangeStart);
                setFilterMode("range");
                setWeekRangeEnd(nextEnd);
              }}
              className={`pointer-events-none absolute inset-0 h-7 w-full appearance-none bg-transparent ${activeHandle === "end" ? "z-40" : preferEndHandleTop ? "z-[35]" : "z-30"} [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-12px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0b4f8a] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.16)] dark:hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.22)] dark:[&::-webkit-slider-thumb]:border-sky-300 dark:[&::-webkit-slider-thumb]:bg-slate-900 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#0b4f8a] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:transition-shadow [&::-moz-range-thumb]:duration-150 hover:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.16)] dark:hover:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.22)] dark:[&::-moz-range-thumb]:border-sky-300 dark:[&::-moz-range-thumb]:bg-slate-900 ${activeHandle === "end" ? "[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.24)] dark:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.3)] [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(11,79,138,0.24)] dark:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(125,211,252,0.3)]" : ""}`}
            />

            {activeHandle === "start" ? (
              <div
                className="pointer-events-none absolute -top-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                style={{
                  left: `${startBubbleLeftPercent}%`,
                  transform: "translateX(-50%)",
                }}
              >
                W{weekRangeStart}: {startWeekDateText}
              </div>
            ) : null}

            {activeHandle === "end" ? (
              <div
                className="pointer-events-none absolute -top-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                style={{
                  left: `${endBubbleLeftPercent}%`,
                  transform: endPercent > 90 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                W{weekRangeEnd}: {endWeekDateText}
              </div>
            ) : null}
          </div>

          <div className="ml-1 min-w-[9rem] text-right font-mono text-[10px] text-slate-600 dark:text-slate-300">
            {startWeekDateText} ~ {endWeekDateText}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-md bg-white dark:bg-slate-900"
        onMouseLeave={() => {
          if (!isPopupLocked) {
            setHover(null);
          }
        }}
      >
        <path
          d={pathBuilder({ type: "Sphere" }) ?? ""}
          className="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-500"
          strokeWidth={1}
        />

        <path d={graticulePath} fill="none" stroke="#94a3b8" strokeOpacity={0.45} strokeWidth={0.8} />

        {displayedPoints.map(({ point, x, y, color, radius, activeExposureKs }) => (
          <g key={`${point.sourceId}-${point.ra}-${point.dec}`}>
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={color}
              fillOpacity={0.62}
              stroke="#111827"
              strokeWidth={0.45}
              onPointerEnter={() => {
                if (!isPopupLocked) {
                  setHover({ point, x, y });
                }
              }}
              onPointerLeave={() => {
                if (!isPopupLocked) {
                  setHover((current) => (current?.point.sourceId === point.sourceId ? null : current));
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                const nextHover = { point, x, y };
                setHover(nextHover);
                setLockedHover(nextHover);
              }}
            />
            {activeExposureKs > 0 ? (
              <text
                x={x}
                y={y + 1.5}
                fontSize={6}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.72}
                className="text-slate-800 dark:text-slate-200"
                pointerEvents="none"
              >
                {Math.round(activeExposureKs)}
              </text>
            ) : null}
          </g>
        ))}

        {raTickMarks.map(({ lon, x, y, raLabel }) => (
          <g key={`tick-${lon}`}>
            <line x1={x} y1={y - 4} x2={x} y2={y + 4} className="stroke-slate-600 dark:stroke-slate-300" strokeOpacity={0.5} strokeWidth={0.8} />
            <text x={x} y={y + 16} fontSize={10} textAnchor="middle" className="fill-slate-700 dark:fill-slate-300">
              {raLabel} deg
            </text>
          </g>
        ))}

        <text x={width / 2} y={28} textAnchor="middle" fontSize={15} className="fill-slate-800 dark:fill-slate-200" fontWeight={600}>
          All Sources Sky Distribution
        </text>
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#d62728]" />Priority A</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#1f77b4]" />Priority B</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#2ca02c]" />Priority C</span>
      </div>

      {activePopup ? (
        <div
          className="absolute z-20 max-w-sm rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: `${Math.min((activePopup.x / width) * 100 + 2, 74)}%`,
            top: `${Math.min((activePopup.y / height) * 100 + 2, 78)}%`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="pr-2 font-semibold text-slate-900 dark:text-slate-100">
              {activePopup.point.sourceName ?? "Unknown Source"}
            </p>
            <div className="flex items-center gap-1">
              {isPopupLocked ? (
                <>
                  <div className="flex items-center justify-end gap-1 min-w-[3.6rem]">
                    {copiedToken === "popup" ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span>
                    ) : (
                      <span className="invisible text-[10px]">Copied</span>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      title="Copy popup"
                      onClick={() => void copyText(buildPopupText(activePopup.point), "popup")}
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                        <rect x="5" y="3" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        <rect x="2" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    title="Close popup"
                    onClick={clearPopupLock}
                  >
                    x
                  </button>
                </>
              ) : (
                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                  Click to lock
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-slate-700 dark:text-slate-200">
            Source ID: {isPopupLocked ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 font-mono hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(String(activePopup.point.sourceId), "sid")}
                >
                  {activePopup.point.sourceId}
                </button>
                {copiedToken === "sid" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
              </span>
            ) : activePopup.point.sourceId}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            Proposal: {isPopupLocked ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.proposalNo ?? "-", "proposal")}
                >
                  {activePopup.point.proposalNo ?? "-"}
                </button>
                {copiedToken === "proposal" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
              </span>
            ) : activePopup.point.proposalNo ?? "-"}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            PI: {isPopupLocked ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.pi ?? "-", "pi")}
                >
                  {activePopup.point.pi ?? "-"}
                </button>
                {copiedToken === "pi" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
              </span>
            ) : activePopup.point.pi ?? "-"}
          </p>
          <p className="text-slate-700 dark:text-slate-200">Obs Type: {activePopup.point.obsType ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">Priority: {activePopup.point.sourcePriority ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">
            RA/Dec: {isPopupLocked ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 font-mono hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.ra.toFixed(4), "ra")}
                >
                  {activePopup.point.ra.toFixed(4)}
                </button>
                <span>/</span>
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 font-mono hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.dec.toFixed(4), "dec")}
                >
                  {activePopup.point.dec.toFixed(4)}
                </button>
                {copiedToken === "ra" || copiedToken === "dec" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
              </span>
            ) : (
              <span>{activePopup.point.ra.toFixed(4)} / {activePopup.point.dec.toFixed(4)}</span>
            )}
          </p>
          <p className="text-slate-700 dark:text-slate-200">Exposure: {activePopup.point.totalExposureTimeAll.toLocaleString()} s</p>
          <p className="text-slate-700 dark:text-slate-200">Scheduled Visits: {activePopup.point.nScheduled}</p>
          <p className="text-slate-700 dark:text-slate-200">
            Scheduled Week Range: {activePopup.point.minWeek ?? "-"} - {activePopup.point.maxWeek ?? "-"}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            Scheduled Date Range: {isPopupLocked ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 font-mono hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.scheduledDateStart ?? "-", "date-start")}
                >
                  {activePopup.point.scheduledDateStart ?? "-"}
                </button>
                {copiedToken === "date-start" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
                <span>to</span>
                <button
                  type="button"
                  className="rounded border border-dashed border-slate-400 px-1 font-mono hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-800"
                  onClick={() => void copyText(activePopup.point.scheduledDateEnd ?? "-", "date-end")}
                >
                  {activePopup.point.scheduledDateEnd ?? "-"}
                </button>
                {copiedToken === "date-end" ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
              </span>
            ) : (
              <span>{activePopup.point.scheduledDateStart ?? "-"} - {activePopup.point.scheduledDateEnd ?? "-"}</span>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
