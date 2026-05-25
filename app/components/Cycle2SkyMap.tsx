"use client";

import { geoGraticule, geoPath } from "d3-geo";
import { geoMollweide } from "d3-geo-projection";
import { InputNumber } from "antd";
import { Slider } from "antd";
import type { InputNumberProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cycle2GanttChart from "./Cycle2GanttChart";

type SkyPoint = {
  dataset: "cycle2" | "gf";
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
  visibleDateRanges: string | null;
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
const GF_POINT_COLOR = "#fef08a";

function getPointKey(point: Pick<SkyPoint, "dataset" | "sourceId">): string {
  return `${point.dataset}:${point.sourceId}`;
}

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
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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
          const color = point.dataset === "gf"
            ? GF_POINT_COLOR
            : PRIORITY_COLORS[point.sourcePriority ?? ""] ?? "#111827";
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
  const cycle2TimelinePoints = useMemo(
    () => data?.points.filter((point) => point.dataset === "cycle2") ?? [],
    [data],
  );

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

  useEffect(() => {
    if (!activePopup) {
      setPopupPosition(null);
      return;
    }

    const updatePopupPosition = () => {
      const container = containerRef.current;
      const svg = svgRef.current;
      const popup = popupRef.current;
      if (!container || !svg || !popup) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const scaleX = svgRect.width / width;
      const scaleY = svgRect.height / height;
      const pointLeft = svgRect.left - containerRect.left + activePopup.x * scaleX;
      const pointTop = svgRect.top - containerRect.top + activePopup.y * scaleY;
      const gap = 12;
      const padding = 8;

      let left = pointLeft + gap;
      let top = pointTop + gap;

      if (left + popupRect.width > containerRect.width - padding) {
        left = pointLeft - popupRect.width - gap;
      }
      if (left < padding) {
        left = padding;
      }

      if (top + popupRect.height > containerRect.height - padding) {
        top = pointTop - popupRect.height - gap;
      }
      if (top < padding) {
        top = Math.max(padding, containerRect.height - popupRect.height - padding);
      }

      setPopupPosition({ left, top });
    };

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    return () => window.removeEventListener("resize", updatePopupPosition);
  }, [activePopup, height, width]);

  const clearPopupLock = useCallback(() => {
    setLockedHover(null);
    setHover(null);
  }, []);

  const handleWeekInputChange = useCallback<NonNullable<InputNumberProps<number>["onChange"]>>((value) => {
    if (value === null) {
      setFilterMode("single");
      setSelectedWeek(null);
      return;
    }

    const clamped = Math.max(weekMin, Math.min(weekMax, value));
    setFilterMode("single");
    setSelectedWeek(clamped);
    setWeekRangeStart(clamped);
    setWeekRangeEnd(clamped);
  }, [weekMin, weekMax]);

  const handleWeekRangeChange = useCallback((value: number[]) => {
    if (value.length < 2) return;
    const [nextStartRaw, nextEndRaw] = value;
    const nextStart = Math.max(weekMin, Math.min(weekMax, nextStartRaw));
    const nextEnd = Math.max(nextStart, Math.min(weekMax, nextEndRaw));
    setFilterMode("range");
    setWeekRangeStart(nextStart);
    setWeekRangeEnd(nextEnd);
  }, [weekMin, weekMax]);

  const formatWeekTooltip = useCallback((value?: number) => {
    if (!Number.isFinite(value)) return null;
    const weekIndex = value as number;
    const weekStart = weekBoundMap.get(weekIndex)?.startDate ?? "-";
    return `W${weekIndex}: ${weekStart}`;
  }, [weekBoundMap]);

  const startWeekDateText = weekBoundMap.get(weekRangeStart)?.startDate ?? "-";
  const endWeekDateText = weekBoundMap.get(weekRangeEnd)?.endDate ?? "-";

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
      ref={containerRef}
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
          <InputNumber
            id="week-filter"
            size="small"
            min={weekMin}
            max={weekMax}
            value={selectedWeek}
            onChange={handleWeekInputChange}
            className="week-filter-input-number w-16"
          />
          <div className="min-w-[6.25rem]">
            {filterMode === "range" ? (
              <span className="inline-flex h-5 items-center rounded-md border border-sky-300 bg-sky-100 px-2 text-[11px] font-medium text-sky-700 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                manual range
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex h-5 items-center rounded-md border border-sky-400 bg-sky-50 px-2 text-[11px] font-semibold text-sky-800 transition-colors hover:bg-sky-100 active:bg-sky-200 dark:border-sky-600 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-900/40 dark:active:bg-sky-900/60"
                onClick={() => {
                  setFilterMode("single");
                  setSelectedWeek(null);
                  setWeekRangeStart(weekMin);
                  setWeekRangeEnd(weekMax);
                }}
              >
                show all
              </button>
            )}
          </div>

          <div className="relative ml-1 w-[28rem] py-1.5">
            <Slider
              min={weekMin}
              max={weekMax}
              value={[weekRangeStart, weekRangeEnd]}
              range={{ draggableTrack: true }}
              onChange={handleWeekRangeChange}
              className="week-range-slider"
              styles={{
                rail: { backgroundColor: "var(--week-slider-rail)", height: 4 },
                track: { backgroundColor: "var(--week-slider-track)", height: 4 },
                handle: {
                  borderColor: "var(--week-slider-track)",
                  backgroundColor: "var(--week-slider-handle-bg)",
                  boxShadow: "none",
                },
              }}
              tooltip={{
                formatter: formatWeekTooltip,
                className: "week-range-slider-tooltip",
                rootClassName: "week-range-slider-tooltip",
                placement: "top",
                style: {
                  background: "var(--week-slider-tooltip-bg)",
                  color: "var(--week-slider-tooltip-text)",
                  border: "1px solid var(--week-slider-tooltip-border)",
                },
              }}
            />
          </div>

          <div className="ml-1 min-w-[9rem] text-right font-mono text-[10px] text-slate-600 dark:text-slate-300">
            {startWeekDateText} ~ {endWeekDateText}
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
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
          <g key={`${getPointKey(point)}-${point.ra}-${point.dec}`}>
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={color}
              fillOpacity={point.dataset === "gf" ? 0.55 : 0.62}
              stroke={point.dataset === "gf" ? "none" : "#111827"}
              strokeWidth={point.dataset === "gf" ? 0 : 0.45}
              onPointerEnter={() => {
                if (!isPopupLocked) {
                  setHover({ point, x, y });
                }
              }}
              onPointerLeave={() => {
                if (!isPopupLocked) {
                  setHover((current) => (current && getPointKey(current.point) === getPointKey(point) ? null : current));
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
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#fef08a] border border-slate-300/60" />Cycle2-GF</span>
      </div>

      {activePopup ? (
        <div
          ref={popupRef}
          className="absolute z-20 max-w-sm rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900/95"
          style={popupPosition ? { left: popupPosition.left, top: popupPosition.top } : { left: 8, top: 8 }}
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
            Dataset: {activePopup.point.dataset === "gf" ? "Cycle2-GF" : "Cycle2"}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
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

      <Cycle2GanttChart
        points={cycle2TimelinePoints}
        weekBounds={data.weekBounds}
        filterMode={filterMode}
        selectedWeek={selectedWeek}
        weekRangeStart={weekRangeStart}
        weekRangeEnd={weekRangeEnd}
      />
    </div>
  );
}
