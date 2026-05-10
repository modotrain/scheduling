"use client";

import { geoGraticule, geoPath } from "d3-geo";
import { geoMollweide } from "d3-geo-projection";
import { useEffect, useMemo, useState } from "react";

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

export default function Cycle2SkyMap() {
  const [data, setData] = useState<SkyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

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
          const radius = Math.max(2.75, Math.min(12.5, Math.sqrt(point.pointSize) * 0.6));
          return { point, x, y, color, radius };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) ?? [],
    [data, projection],
  );

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
    <div className="relative rounded-lg ring-1 ring-slate-200 bg-white p-4 dark:ring-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span>
          Sources: <span className="font-mono font-semibold">{data.summary.totalSources}</span>
        </span>
        <span>
          Exposure: <span className="font-mono font-semibold">{data.summary.totalExposureMillionS.toFixed(2)}M s</span>
        </span>
        <span>
          Priority A/B/C: <span className="font-mono font-semibold">{data.summary.priorities.A}/{data.summary.priorities.B}/{data.summary.priorities.C}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-md bg-white dark:bg-slate-900"
        onMouseLeave={() => setHover(null)}
      >
        <path
          d={pathBuilder({ type: "Sphere" }) ?? ""}
          className="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-500"
          strokeWidth={1}
        />

        <path d={graticulePath} fill="none" stroke="#94a3b8" strokeOpacity={0.45} strokeWidth={0.8} />

        {pointMarks.map(({ point, x, y, color, radius }) => (
          <g key={`${point.sourceId}-${point.ra}-${point.dec}`}>
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={color}
              fillOpacity={0.62}
              stroke="#111827"
              strokeWidth={0.45}
              onPointerEnter={() => setHover({ point, x, y })}
              onPointerLeave={() => setHover((current) => (current?.point.sourceId === point.sourceId ? null : current))}
            />
            {point.totalExposureKs > 0 ? (
              <text
                x={x}
                y={y + 1.5}
                fontSize={6}
                textAnchor="middle"
                fill="#0f172a"
                fillOpacity={0.72}
                pointerEvents="none"
              >
                {Math.round(point.totalExposureKs)}
              </text>
            ) : null}
          </g>
        ))}

        {raTickMarks.map(({ lon, x, y, raLabel }) => (
          <g key={`tick-${lon}`}>
            <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke="#334155" strokeOpacity={0.5} strokeWidth={0.8} />
            <text x={x} y={y + 16} fontSize={10} textAnchor="middle" fill="#334155">
              {raLabel} deg
            </text>
          </g>
        ))}

        <text x={width / 2} y={28} textAnchor="middle" fontSize={15} fill="#0f172a" fontWeight={600}>
          All Sources Sky Distribution
        </text>
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#d62728]" />Priority A</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#1f77b4]" />Priority B</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#2ca02c]" />Priority C</span>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-20 max-w-sm rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: `${Math.min((hover.x / width) * 100 + 2, 74)}%`,
            top: `${Math.min((hover.y / height) * 100 + 2, 78)}%`,
          }}
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {hover.point.sourceName ?? "Unknown Source"} (sid={hover.point.sourceId})
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-200">Proposal: {hover.point.proposalNo ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">PI: {hover.point.pi ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">Obs Type: {hover.point.obsType ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">Priority: {hover.point.sourcePriority ?? "-"}</p>
          <p className="text-slate-700 dark:text-slate-200">
            RA/Dec: {hover.point.ra.toFixed(4)} / {hover.point.dec.toFixed(4)}
          </p>
          <p className="text-slate-700 dark:text-slate-200">Exposure: {hover.point.totalExposureTimeAll.toLocaleString()} s</p>
          <p className="text-slate-700 dark:text-slate-200">Scheduled Visits: {hover.point.nScheduled}</p>
          <p className="text-slate-700 dark:text-slate-200">
            Scheduled Week Range: {hover.point.minWeek ?? "-"} to {hover.point.maxWeek ?? "-"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
