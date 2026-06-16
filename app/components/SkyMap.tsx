"use client";

import { geoGraticule, geoPath } from "d3-geo";
import { geoMollweide } from "d3-geo-projection";
import { InputNumber } from "antd";
import { Slider } from "antd";
import type { InputNumberProps } from "antd";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import SkyGanttChart from "./SkyGanttChart";

export type SkyPoint = {
  dataset: string;
  sourceId: number;
  sourceKey?: string;
  sourceName: string | null;
  proposalNo: string | null;
  pi: string | null;
  obsType: string | null;
  sourcePriority: string | null;
  pointType: "normal" | "gp-cal" | "fxt-calibration" | "wxt-calibration" | "too-gp";
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

export type SkyPayload = {
  points: SkyPoint[];
  regions: SkyRegion[];
  weekBounds: Array<{ weekIndex: number; startDate: string | null; endDate: string | null }>;
  summary: {
    totalSources: number;
    totalExposureS: number;
    totalExposureMillionS: number;
    priorities: { A: number; B: number; C: number; D: number };
    fxtCalibration: { count: number; exposureS: number; exposureMillionS: number };
    wxtCalibration: { count: number; exposureS: number; exposureMillionS: number };
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

function getPointKey(point: Pick<SkyPoint, "dataset" | "sourceId">): string {
  return `${point.dataset}:${point.sourceId}`;
}

function getSourceKey(point: SkyPoint): string {
  return point.sourceKey ?? getPointKey(point);
}
function getCalibrationDisplayType(point: SkyPoint): "fxt-calibration" | "wxt-calibration" | null {
  if (point.pointType === "fxt-calibration" || point.pointType === "wxt-calibration") {
    return point.pointType;
  }

  if (point.pointType === "gp-cal") {
    const instrument = (point.pi ?? "").toUpperCase();
    if (instrument.includes("WXT")) return "wxt-calibration";
    if (instrument.includes("FXT")) return "fxt-calibration";
    return "fxt-calibration";
  }

  return null;
}

function getPointRenderKey(point: SkyPoint): string {
  return `${getSourceKey(point)}:${point.ra}:${point.dec}`;
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

type SkyMapProps = {
  cycle?: number;
  dataOverride?: SkyPayload | null;
  loadingOverride?: boolean;
  errorOverride?: string | null;
  title?: string;
  mapHeightClass?: string;
  popupLayout?: "floating" | "side";
  hideWeekControls?: boolean;
  hideGanttChart?: boolean;
  showGfToggle?: boolean;
  showGf?: boolean;
  onShowGfChange?: (next: boolean) => void;
  activeSourceKey?: string | null;
  lockedSourceKey?: string | null;
  onActiveSourceKeyChange?: (key: string | null) => void;
  onLockedSourceKeyChange?: (key: string | null) => void;
  onLocateInList?: (sourceKey: string) => void;
  onLocateOnMap?: (sourceKey: string) => void;
};

export default function SkyMap({
  cycle,
  dataOverride,
  loadingOverride,
  errorOverride,
  title = "All Sources Sky Distribution",
  mapHeightClass = "h-auto",
  popupLayout = "floating",
  hideWeekControls = false,
  hideGanttChart = false,
  showGfToggle = true,
  showGf,
  onShowGfChange,
  activeSourceKey,
  lockedSourceKey,
  onActiveSourceKeyChange,
  onLockedSourceKeyChange,
  onLocateInList,
  onLocateOnMap,
}: SkyMapProps = {}) {
  const cycleQuery = typeof cycle === "number" ? `?cycle=${cycle}` : "";
  const cycleLabel = `Cycle${cycle ?? 2}`;
  const gfLabel = `${cycleLabel}-GF`;
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
  const [localShowGF, setLocalShowGF] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const width = 1300;
  const height = 740;
  const margin = 24;

  const resolvedShowGF = showGf ?? localShowGF;
  const setShowGF = useCallback((next: boolean) => {
    if (onShowGfChange) onShowGfChange(next);
    else setLocalShowGF(next);
  }, [onShowGfChange]);

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
    if (dataOverride) return;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/long-term/skymap${cycleQuery}`, { cache: "no-store" });
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
  }, [cycleQuery, dataOverride]);

  useEffect(() => {
    // Check initial dark mode state
    setIsDarkMode(document.documentElement.classList.contains('dark'));

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const graticulePath = useMemo(() => {
    const graticule = geoGraticule().step([30, 30])();
    return pathBuilder(graticule) ?? "";
  }, [pathBuilder]);

  const pointMarks = useMemo(
    () =>
      (dataOverride ?? data)?.points
        .map((point) => {
          const projected = projection([toMollweideLon(point.ra), point.dec]);
          if (!projected) return null;
          const [x, y] = projected;
          let color: string;
          if (point.pointType === "fxt-calibration") {
            color = "#8b5cf6"; // Purple for FXT
          } else if (point.pointType === "wxt-calibration") {
            color = "#f59e0b"; // Amber for WXT
          } else if (point.pointType === "too-gp") {
            color = "#14b8a6";
          } else if (point.pointType === "gp-cal") {
            color = "#8b5cf6";
          } else if (point.dataset === "gf") {
            color = isDarkMode ? "#d4af37" : "#fef3c7";
          } else {
            color = PRIORITY_COLORS[point.sourcePriority ?? ""] ?? "#111827";
          }
          return { point, x, y, color };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) ?? [],
    [data, dataOverride, projection, isDarkMode],
  );

  const weekMin = useMemo(() => {
    const currentData = dataOverride ?? data;
    if (!currentData?.weekBounds?.length) return 1;
    return Math.min(...currentData.weekBounds.map((item) => item.weekIndex));
  }, [data, dataOverride]);

  const weekMax = useMemo(() => {
    const currentData = dataOverride ?? data;
    if (!currentData?.weekBounds?.length) return 52;
    return Math.max(...currentData.weekBounds.map((item) => item.weekIndex));
  }, [data, dataOverride]);

  const weekBoundMap = useMemo(() => {
    return new Map(((dataOverride ?? data)?.weekBounds ?? []).map((item) => [item.weekIndex, item]));
  }, [data, dataOverride]);

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
      .filter((item) => resolvedShowGF || item.point.dataset !== "gf")
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
  }, [pointMarks, filterMode, selectedWeek, computeExposureSInActiveRange, resolvedShowGF]);

  const activeSummary = useMemo(() => {
    const priorities = { A: 0, B: 0, C: 0, D: 0 };
    let totalExposureS = 0;

    for (const item of displayedPoints) {
      totalExposureS += item.activeExposureS;
      if (item.point.dataset === "gf") {
        priorities.D += 1;
      } else if (item.point.sourcePriority === "A") priorities.A += 1;
      else if (item.point.sourcePriority === "B") priorities.B += 1;
      else if (item.point.sourcePriority === "C") priorities.C += 1;
    }

    return {
      totalSources: displayedPoints.length,
      totalExposureMillionS: totalExposureS / 1_000_000,
      priorities,
    };
  }, [displayedPoints]);

  const activeCalibrationStats = useMemo(() => {
    const normalPoints = displayedPoints.filter((item) => item.point.pointType === "normal");
    const fxtPoints = displayedPoints.filter((item) => getCalibrationDisplayType(item.point) === "fxt-calibration");
    const wxtPoints = displayedPoints.filter((item) => getCalibrationDisplayType(item.point) === "wxt-calibration");

    const fxtExposureS = fxtPoints.reduce((sum, item) => sum + item.activeExposureS, 0);
    const wxtExposureS = wxtPoints.reduce((sum, item) => sum + item.activeExposureS, 0);

    return {
      fxtCount: fxtPoints.length,
      fxtExposureMillionS: fxtExposureS / 1_000_000,
      wxtCount: wxtPoints.length,
      wxtExposureMillionS: wxtExposureS / 1_000_000,
    };
  }, [displayedPoints]);

  const legendItems = useMemo(() => {
    const hasPriority = (priority: string) => displayedPoints.some((item) => item.point.pointType === "normal" && item.point.sourcePriority === priority);
    const hasGf = displayedPoints.some((item) => item.point.dataset === "gf");
    const hasFxt = displayedPoints.some((item) => getCalibrationDisplayType(item.point) === "fxt-calibration");
    const hasWxt = displayedPoints.some((item) => getCalibrationDisplayType(item.point) === "wxt-calibration");
    const hasTooGp = displayedPoints.some((item) => item.point.pointType === "too-gp");

    return [
      hasPriority("A") ? { key: "priority-a", label: "Priority A", kind: "dot" as const, color: "#d62728" } : null,
      hasPriority("B") ? { key: "priority-b", label: "Priority B", kind: "dot" as const, color: "#1f77b4" } : null,
      hasPriority("C") ? { key: "priority-c", label: "Priority C", kind: "dot" as const, color: "#2ca02c" } : null,
      hasGf ? { key: "gf", label: gfLabel, kind: "dot" as const, color: isDarkMode ? "#d4af37" : "#fef3c7" } : null,
      hasFxt ? { key: "fxt", label: "FXT-Cal", kind: "triangle" as const, color: "#8b5cf6" } : null,
      hasWxt ? { key: "wxt", label: "WXT-Cal", kind: "triangle" as const, color: "#f59e0b" } : null,
      hasTooGp ? { key: "toogp", label: "ToO-GP", kind: "diamond" as const, color: "#14b8a6" } : null,
    ].filter((item): item is { key: string; label: string; kind: "dot" | "triangle" | "diamond"; color: string } => item !== null);
  }, [displayedPoints, gfLabel, isDarkMode]);

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
  const cycleTimelinePoints = useMemo(
    () => (dataOverride ?? data)?.points.filter((point) => point.dataset !== "gf") ?? [],
    [data, dataOverride],
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

  useLayoutEffect(() => {
    if (!activePopup || popupLayout === "side") {
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
  }, [activePopup, height, popupLayout, width]);

  const floatingPopupStyle = popupPosition
    ? { left: popupPosition.left, top: popupPosition.top }
    : { left: -9999, top: -9999, visibility: "hidden" as const };

  const clearPopupLock = useCallback(() => {
    setLockedHover(null);
    setHover(null);
    onActiveSourceKeyChange?.(null);
    onLockedSourceKeyChange?.(null);
  }, [onActiveSourceKeyChange, onLockedSourceKeyChange]);

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

  const effectiveLoading = loadingOverride ?? loading;
  const effectiveError = errorOverride ?? error;
  const effectiveData = dataOverride ?? data;

  if (effectiveLoading) {
    return (
      <div className="rounded-lg ring-1 ring-slate-200 bg-white p-6 dark:ring-slate-700 dark:bg-slate-900">
        <div className="flex justify-center">
          <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
        </div>
      </div>
    );
  }

  if (effectiveError || !effectiveData) {
    return (
      <div className="rounded-lg ring-1 ring-slate-200 bg-white p-6 text-sm text-rose-600 dark:ring-slate-700 dark:bg-slate-900 dark:text-rose-300">
        {effectiveError ?? "No sky map data available"}
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
      <div className="mb-4 flex flex-wrap items-start gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex flex-col gap-y-1.5">
          <div className="flex items-center gap-x-5">
            <span>
              Sources: <span className="font-mono font-semibold">{activeSummary.totalSources}</span>
            </span>
            <span>
              Exposure: <span className="font-mono font-semibold">{activeSummary.totalExposureMillionS.toFixed(2)}M s</span>
            </span>
            <span>
              Priority A/B/C/D: <span className="font-mono font-semibold">{activeSummary.priorities.A}/{activeSummary.priorities.B}/{activeSummary.priorities.C}/{activeSummary.priorities.D}</span>
            </span>
          </div>
          {effectiveData?.summary && (
            <>
              <div className="flex items-center gap-x-5">
                <span>
                  FXT-Cal: <span className="font-mono font-semibold">{activeCalibrationStats.fxtCount}</span> sources, <span className="font-mono font-semibold">{activeCalibrationStats.fxtExposureMillionS.toFixed(2)}M s</span>
                </span>
              </div>
              <div className="flex items-center gap-x-5">
                <span>
                  WXT-Cal: <span className="font-mono font-semibold">{activeCalibrationStats.wxtCount}</span> sources, <span className="font-mono font-semibold">{activeCalibrationStats.wxtExposureMillionS.toFixed(2)}M s</span>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          {showGfToggle && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resolvedShowGF}
                  onChange={(e) => setShowGF(e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">GF</span>
              </label>

              <div className="w-px bg-slate-300 dark:bg-slate-600" style={{ height: "1.25rem" }} />
            </>
          )}

          {!hideWeekControls && (
            <>
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
            </>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`${mapHeightClass} w-full rounded-md bg-white dark:bg-slate-900`}
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

        {[...displayedPoints]
          .sort((a, b) => {
            const aRank = a.point.dataset === "gf" ? 0 : 1;
            const bRank = b.point.dataset === "gf" ? 0 : 1;
            return aRank - bRank;
          })
          .map(({ point, x, y, color, radius, activeExposureKs }, idx) => {
          const commonProps = {
            fill: color,
            fillOpacity: point.dataset === "gf" ? 0.45 : 0.62,
            stroke: point.dataset === "gf" ? "none" : "#111827",
            strokeWidth:
              (lockedSourceKey ?? activeSourceKey) && getSourceKey(point) === (lockedSourceKey ?? activeSourceKey)
                ? 1.75
                : (point.dataset === "gf" ? 0 : 0.45),
            onPointerEnter: () => {
              if (!isPopupLocked) {
                setHover({ point, x, y });
              }
              onActiveSourceKeyChange?.(getSourceKey(point));
            },
            onPointerLeave: () => {
              if (!isPopupLocked) {
                setHover((current) => (current && getPointKey(current.point) === getPointKey(point) ? null : current));
              }
              if (!lockedSourceKey) onActiveSourceKeyChange?.(null);
            },
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation();
              const nextHover = { point, x, y };
              setHover(nextHover);
              setLockedHover(nextHover);
              onLockedSourceKeyChange?.(getSourceKey(point));
            },
          };

          let shape = null;
          const calibrationType = getCalibrationDisplayType(point);
          if (calibrationType === "fxt-calibration" || calibrationType === "wxt-calibration") {
            // Calibration sources: triangle, color-coded by instrument
            const h = radius * 1.8;
            const w = radius * 1.6;
            const points = `${x},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`;
            shape = (
              <polygon
                points={points}
                {...commonProps}
              />
            );
          } else if (point.pointType === "too-gp") {
            // ToO-GP: diamond
            const d = `${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}`;
            shape = (
              <polygon
                points={d}
                {...commonProps}
              />
            );
          } else if (point.pointType === "wxt-calibration") {
            // WXT: triangle (pointing up)
            const h = radius * 1.8;
            const w = radius * 1.6;
            const points = `${x},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`;
            shape = (
              <polygon
                points={points}
                {...commonProps}
              />
            );
          } else {
            // Normal or GF: circle
            shape = (
              <circle
                cx={x}
                cy={y}
                r={radius}
                {...commonProps}
              />
            );
          }

          return (
            <g key={`${getPointRenderKey(point)}:${idx}`}>
              {shape}
              {point.dataset !== "gf" && point.pointType === "normal" && activeExposureKs > 0 ? (
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
          );
          })}

        {raTickMarks.map(({ lon, x, y, raLabel }) => (
          <g key={`tick-${lon}`}>
            <line x1={x} y1={y - 4} x2={x} y2={y + 4} className="stroke-slate-600 dark:stroke-slate-300" strokeOpacity={0.5} strokeWidth={0.8} />
            <text x={x} y={y + 16} fontSize={10} textAnchor="middle" className="fill-slate-700 dark:fill-slate-300">
              {raLabel} deg
            </text>
          </g>
        ))}

        <text x={width / 2} y={28} textAnchor="middle" fontSize={15} className="fill-slate-800 dark:fill-slate-200" fontWeight={600}>
          {title}
        </text>
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        {legendItems.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1">
            {item.kind === "dot" ? (
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            ) : item.kind === "triangle" ? (
              <svg className="inline-block h-2 w-2" viewBox="0 0 8 8">
                <polygon points="4,1 7,7 1,7" fill={item.color} />
              </svg>
            ) : (
              <svg className="inline-block h-2 w-2" viewBox="0 0 8 8">
                <polygon points="4,0.8 7.2,4 4,7.2 0.8,4" fill={item.color} />
              </svg>
            )}
            {item.label}
          </span>
        ))}
      </div>

      {activePopup ? (
        <div
          ref={popupRef}
          className={`z-20 max-w-sm rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900/95 ${
            popupLayout === "side" ? "absolute right-2 top-2" : "absolute"
          }`}
          style={popupLayout === "floating" ? floatingPopupStyle : undefined}
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
            Dataset: {activePopup.point.dataset === "gf" ? gfLabel : cycleLabel}
          </p>
          {isPopupLocked && activePopup.point.sourceKey ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/40"
                onClick={() => onLocateInList?.(activePopup.point.sourceKey as string)}
              >
                Locate in list
              </button>
              <button
                type="button"
                className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40"
                onClick={() => onLocateOnMap?.(activePopup.point.sourceKey as string)}
              >
                Locate on map
              </button>
            </div>
          ) : null}
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

      {!hideGanttChart && (
        <SkyGanttChart
          points={cycleTimelinePoints}
          weekBounds={effectiveData.weekBounds}
          filterMode={filterMode}
          selectedWeek={selectedWeek}
          weekRangeStart={weekRangeStart}
          weekRangeEnd={weekRangeEnd}
        />
      )}
    </div>
  );
}
