"use client";

import { useEffect, useState, useRef } from "react";

interface ScheduledObs {
  date: string;
  exp_s: number;
  week: number | null;
}

interface ChartData {
  visibleRanges: Array<[string, string]>;
  visibleTotalDays: number;
  scheduledObs: ScheduledObs[];
  dateRange: { min: string; max: string };
  obsType: string;
  color?: string;
}

interface SourceReportChartProps {
  sourceId: string | null;
  isDarkMode?: boolean;
  embedded?: boolean;
}

interface TooltipData {
  x: number;
  y: number;
  date: string;
  exp_s: number;
  week: number | null;
}

export default function SourceReportChart({
  sourceId,
  isDarkMode = false,
  embedded = false,
}: SourceReportChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dark, setDark] = useState(isDarkMode);

  // Detect app theme (dark class) with system fallback.
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncDark = () => {
      const byClass = root.classList.contains("dark");
      const hasLightClass = root.classList.contains("light");
      setDark(isDarkMode || byClass || (!hasLightClass && mediaQuery.matches));
    };

    const handleChange = () => syncDark();
    mediaQuery.addEventListener("change", handleChange);

    const observer = new MutationObserver(syncDark);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    syncDark();

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      observer.disconnect();
    };
  }, [isDarkMode]);

  // Fetch chart data
  useEffect(() => {
    if (!sourceId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/gp-cycle2/source-report?sourceId=${sourceId}`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setChartData(data.chartData);
      } catch (err) {
        console.error("Failed to fetch source report:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sourceId]);

  if (!sourceId) {
    return null;
  }

  if (loading) {
    return (
      <div className={embedded ? "" : "mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900"}>
        <div className="px-4 py-6 flex justify-center">
          <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70" />
        </div>
      </div>
    );
  }

  if (error || !chartData) {
    return (
      <div className={embedded ? "" : "mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900"}>
        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          {error ? `Failed to load chart: ${error}` : "No chart data available"}
        </div>
      </div>
    );
  }

  // Parse dates
  const minDate = new Date(chartData.dateRange.min);
  const maxDate = new Date(chartData.dateRange.max);
  const totalDays = Math.ceil(
    (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Chart dimensions
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max exposure for Y-axis scale
  const maxExp =
    Math.max(...(chartData.scheduledObs.map((o) => o.exp_s) || [1])) / 1000;
  const maxY = Math.ceil(maxExp * 1.25);

  // Colors
  const bgColor = dark ? "#0b1220" : "#f8fafc";
  const textColor = dark ? "#cbd5e1" : "#1e293b";
  const gridColor = dark ? "#334155" : "#cbd5e1";
  const obsColor = chartData.color || "#000000";

  // Helper functions
  const dateToX = (dateStr: string): number => {
    const d = new Date(dateStr);
    const daysFromMin = Math.ceil(
      (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return padding.left + (daysFromMin / totalDays) * chartWidth;
  };

  const expToY = (expS: number): number => {
    const expK = expS / 1000;
    return padding.top + chartHeight - (expK / maxY) * chartHeight;
  };

  // Render visible ranges as grey background
  const visibleRects = chartData.visibleRanges.map((range, i) => {
    const x1 = dateToX(range[0]);
    const x2 = dateToX(range[1]);
    return (
      <rect
        key={`visible-${i}`}
        x={x1}
        y={padding.top}
        width={x2 - x1}
        height={chartHeight}
        fill={dark ? "#334155" : "#e2e8f0"}
        opacity="0.4"
      />
    );
  });

  // Render Y-axis grid lines
  const gridLines = [];
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    const value = maxY - (maxY / 5) * i;
    gridLines.push(
      <line
        key={`grid-${i}`}
        x1={padding.left}
        y1={y}
        x2={width - padding.right}
        y2={y}
        stroke={gridColor}
        strokeWidth="0.5"
        opacity="0.5"
      />,
      <text
        key={`label-${i}`}
        x={padding.left - 10}
        y={y + 4}
        fontSize="12"
        fill={textColor}
        textAnchor="end"
      >
        {value.toFixed(1)}
      </text>
    );
  }

  // Render scheduled observations
  const obsLines = chartData.scheduledObs.map((obs, i) => {
    if (!obs.date) return null;
    const x = dateToX(obs.date);
    const y = expToY(obs.exp_s);
    return (
      <g key={`obs-${i}`}>
        <line
          x1={x}
          y1={padding.top + chartHeight}
          x2={x}
          y2={y}
          stroke={obsColor}
          strokeWidth="2"
          opacity="0.85"
        />
        <circle
          cx={x}
          cy={y}
          r="4"
          fill={obsColor}
          stroke="black"
          strokeWidth="0.5"
          opacity="0.85"
          style={{ cursor: "pointer" }}
          onMouseEnter={() =>
            setTooltip({
              x,
              y,
              date: obs.date,
              exp_s: obs.exp_s,
              week: obs.week,
            })
          }
          onMouseLeave={() => setTooltip(null)}
        />
      </g>
    );
  });

  // Render X-axis date labels (every ~3 months)
  const dateLabels = [];
  const step = Math.ceil(totalDays / 4);
  for (let d = 0; d <= totalDays; d += step) {
    const labelDate = new Date(minDate);
    labelDate.setDate(labelDate.getDate() + d);
    const x = padding.left + (d / totalDays) * chartWidth;
    const dateStr = labelDate.toISOString().split("T")[0];
    dateLabels.push(
      <line
        key={`tick-${d}`}
        x1={x}
        y1={height - padding.bottom + 5}
        x2={x}
        y2={height - padding.bottom + 10}
        stroke={textColor}
      />,
      <text
        key={`date-label-${d}`}
        x={x}
        y={height - padding.bottom + 25}
        fontSize="11"
        fill={textColor}
        textAnchor="middle"
      >
        {dateStr}
      </text>
    );
  }

  return (
    <div className={embedded ? "overflow-hidden" : "mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-900 overflow-hidden"}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Observation Schedule Timeline
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Visible windows (grey) and scheduled observations ({chartData.obsType})
          </p>
        </div>
        <a
          href={`/api/gp-cycle2/source-reports/download?sourceId=${sourceId}`}
          download
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Schedule
        </a>
      </div>

      <div className="overflow-x-auto p-4 bg-slate-50/50 dark:bg-slate-900/60">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            backgroundColor: bgColor,
            borderRadius: "0.5rem",
            minWidth: "100%",
          }}
        >
          {/* Visible ranges background */}
          {visibleRects}

          {/* Grid lines and labels */}
          {gridLines}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke={textColor}
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke={textColor}
            strokeWidth="1"
          />

          {/* Date labels and ticks */}
          {dateLabels}

          {/* Y-axis label */}
          <text
            x="15"
            y={padding.top + chartHeight / 2}
            fontSize="12"
            fill={textColor}
            textAnchor="middle"
            transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}
          >
            Exposure (ks)
          </text>

          {/* Observations */}
          {obsLines}

          {/* Tooltip */}
          {tooltip && (
            <g>
              <rect
                x={tooltip.x + 10}
                y={tooltip.y - 50}
                width="120"
                height="45"
                fill={dark ? "#0f172a" : "#ffffff"}
                stroke={textColor}
                strokeWidth="1"
                rx="4"
              />
              <text
                x={tooltip.x + 15}
                y={tooltip.y - 35}
                fontSize="12"
                fill={textColor}
                fontWeight="500"
              >
                {tooltip.date}
              </text>
              <text
                x={tooltip.x + 15}
                y={tooltip.y - 20}
                fontSize="11"
                fill={textColor}
              >
                Exp: {tooltip.exp_s} s
              </text>
              {tooltip.week !== null && (
                <text
                  x={tooltip.x + 15}
                  y={tooltip.y - 7}
                  fontSize="11"
                  fill={textColor}
                >
                  Week: {tooltip.week}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-8 rounded-sm"
            style={{
              backgroundColor: dark ? "#475569" : "#cbd5e1",
              opacity: 0.4,
            }}
          />
          <span className="text-slate-600 dark:text-slate-400">Visible window</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-0.5 h-8"
            style={{ backgroundColor: obsColor, opacity: 0.85 }}
          />
          <div
            className="w-2 h-2 rounded-full border border-black"
            style={{ backgroundColor: obsColor, opacity: 0.85 }}
          />
          <span className="text-slate-600 dark:text-slate-400">{chartData.obsType} obs</span>
        </div>
      </div>
    </div>
  );
}
