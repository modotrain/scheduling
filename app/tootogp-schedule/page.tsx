"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getWeekKey } from "@/app/lib/week-utils";

type GpPlanningListRow = {
  id: number;
  approvedTooId: number;
  pi: string | null;
  sourceName: string | null;
  parentEpDbObjectId: string;
  generatedEpDbObjectId: string;
  sequenceNo: number;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  cadenceValue: number | null;
  cadenceUnit: string | null;
  reviewedSingleExposureTimeSnapshot: number | null;
  reviewedTotalExposureTimeSnapshot: number | null;
  reviewedNumberOfVisitsSnapshot: number | null;
  status: string;
  scheduledStatus: "scheduled" | "queued";
  matchedObsWpId: number | null;
  weekId: string | null; // derived client-side from plannedStartTime
};

type SortConfig = { col: keyof GpPlanningListRow | null; dir: "asc" | "desc" };

const TABLE_COLS: (keyof GpPlanningListRow)[] = [
  "id",
  "sourceName",
  "pi",
//   "parentEpDbObjectId",
  "generatedEpDbObjectId",
  "reviewedSingleExposureTimeSnapshot",
  "reviewedNumberOfVisitsSnapshot",
  "weekId",
  "plannedStartTime",
  "plannedEndTime",
  "scheduledStatus",
];

const COL_LABELS: Partial<Record<keyof GpPlanningListRow, string>> = {
  id: "ID",
  sourceName: "Source",
  pi: "PI",
  parentEpDbObjectId: "Parent DB ID",
  generatedEpDbObjectId: "Planned DB ID",
  reviewedSingleExposureTimeSnapshot: "Exp.",
  reviewedNumberOfVisitsSnapshot: "Visits",
  weekId: "Week",
  plannedStartTime: "Start",
  plannedEndTime: "End",
  scheduledStatus: "Status",
};

const GP_PLANNING_CACHE_KEY = "tootogp-schedule-cache-v2";
const GP_PLANNING_CACHE_TTL_MS = 10 * 1000;
const GP_PLANNING_VIEW_KEY = "tootogp-schedule-view-v1";

type GpPlanningCachePayload = {
  ts: number;
  rows: GpPlanningListRow[];
};

function addWeekId(r: Omit<GpPlanningListRow, "weekId">): GpPlanningListRow {
  return {
    ...r,
    weekId: r.plannedStartTime ? (getWeekKey(r.plannedStartTime)?.split("-")[1] ?? null) : null,
  };
}

function StatusIndicator({ status }: { status: GpPlanningListRow["scheduledStatus"] }) {
  const scheduled = status === "scheduled";

  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${scheduled ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-sky-500/10 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"}`}>
      {scheduled ? "Scheduled" : "Queued"}
    </span>
  );
}

export default function TooToGpSchedulePage() {
  const [rows, setRows] = useState<GpPlanningListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "queued" | "scheduled">("queued");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ col: null, dir: "asc" });

  const effectiveStatusFilter = hydrated ? statusFilter : "queued";

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(GP_PLANNING_VIEW_KEY);
    if (stored === "all" || stored === "queued" || stored === "scheduled") {
      setStatusFilter(stored);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const rawCache = sessionStorage.getItem(GP_PLANNING_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as GpPlanningCachePayload;
        if (Date.now() - parsed.ts < GP_PLANNING_CACHE_TTL_MS) {
          setRows((parsed.rows ?? []).map(addWeekId));
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/tootogp-schedule", { cache: "no-store" });
      const data = (await response.json()) as { rows?: Omit<GpPlanningListRow, "weekId">[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load GP planning list");
      }

      const nextRows = (data.rows ?? []).map(addWeekId);
      setRows(nextRows);
      sessionStorage.setItem(GP_PLANNING_CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: nextRows }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load GP planning list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  function handleSort(col: keyof GpPlanningListRow) {
    setSortConfig((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function handleStatusFilterChange(next: "all" | "queued" | "scheduled") {
    setStatusFilter(next);
    localStorage.setItem(GP_PLANNING_VIEW_KEY, next);
  }

  function getSortedAndFilteredRows() {
    const query = searchText.toLowerCase().trim();
    const normalizeDate = (value: string | null) => {
      if (!value) return "";
      const dateTimeSplit = value.split(" ")[0] ?? "";
      return dateTimeSplit.split("T")[0] ?? "";
    };

    const filtered = rows.filter((row) => {
      if (effectiveStatusFilter !== "all" && row.scheduledStatus !== effectiveStatusFilter) return false;
      if (
        query &&
        !Object.values(row).some(
          (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(query),
        )
      ) {
        return false;
      }

      const rowStart = normalizeDate(row.plannedStartTime);
      const rowEnd = normalizeDate(row.plannedEndTime);

      // For range filtering, include rows that overlap with the selected window.
      const effectiveStart = rowStart || rowEnd;
      const effectiveEnd = rowEnd || rowStart;

      if (startDateFilter && (!effectiveEnd || effectiveEnd < startDateFilter)) {
        return false;
      }

      if (endDateFilter && (!effectiveStart || effectiveStart > endDateFilter)) {
        return false;
      }

      return true;
    });

    if (!sortConfig.col) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.col!] ?? "";
      const bVal = b[sortConfig.col!] ?? "";
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }

  function SortIcon({ col }: { col: keyof GpPlanningListRow }) {
    if (sortConfig.col !== col) {
      return <span className="ml-1 text-slate-300 dark:text-slate-600">⇅</span>;
    }
    return <span className="ml-1 text-primary">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  }

  const displayRows = getSortedAndFilteredRows();

  const todayStr = new Date().toISOString().split("T")[0]!;

  const weeklyExposure = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.scheduledStatus !== "queued") continue;
      if (!row.plannedStartTime) continue;
      const normalized = row.plannedStartTime.includes("T")
        ? row.plannedStartTime.split("T")[0]!
        : row.plannedStartTime.split(" ")[0]!;
      if (normalized < todayStr) continue;
      const weekKey = getWeekKey(row.plannedStartTime);
      if (!weekKey) continue;
      const ks =
        ((row.reviewedSingleExposureTimeSnapshot ?? 0) *
          (row.reviewedNumberOfVisitsSnapshot ?? 0)) /
        1000;
      map.set(weekKey, (map.get(weekKey) ?? 0) + ks);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, ks]) => ({ weekKey, label: weekKey.split("-")[1]!, ks }));
  }, [rows, todayStr]);

  const maxKs = weeklyExposure.reduce((acc, w) => Math.max(acc, w.ks), 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-2xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">GP Planning Pool</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Manual ToO-to-GP planning rows used to track pre-arranged visits before they are scheduled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/too-management"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← ToO Management
            </Link>
          </div>
        </div>

        {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}

        {weeklyExposure.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Queued exposure by week
            </p>
            <div className="flex items-end gap-2 overflow-x-auto pb-1">
              {weeklyExposure.map(({ weekKey, label, ks }) => {
                const barH = maxKs > 0 ? Math.max(4, Math.round((ks / maxKs) * 64)) : 4;
                return (
                  <div key={weekKey} className="flex shrink-0 flex-col items-center gap-1">
                    <span className="text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                      {ks.toFixed(1)}<span className="ml-0.5 text-[9px] text-slate-400">ks</span>
                    </span>
                    <div
                      style={{ height: barH }}
                      className="w-10 rounded-t bg-sky-400/40 dark:bg-sky-400/25"
                    />
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md ring-1 ring-slate-300 dark:ring-slate-600 text-xs shrink-0">
            <button
              type="button"
              onClick={() => handleStatusFilterChange("queued")}
              className={`px-4 py-1.5 font-medium transition-colors ${
                effectiveStatusFilter === "queued"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Queued
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("scheduled")}
              className={`border-l border-slate-300 px-4 py-1.5 font-medium transition-colors dark:border-slate-600 ${
                effectiveStatusFilter === "scheduled"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Scheduled
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("all")}
              className={`border-l border-slate-300 px-4 py-1.5 font-medium transition-colors dark:border-slate-600 ${
                effectiveStatusFilter === "all"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              All
            </button>
          </div>
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">Time Range</span>
          <input
            type="date"
            value={startDateFilter}
            onChange={(event) => setStartDateFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            aria-label="Filter start date"
          />
          <span className="text-slate-400 dark:text-slate-500">-</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={(event) => setEndDateFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            aria-label="Filter end date"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <th className="whitespace-nowrap px-3 py-2 text-slate-400 dark:text-slate-500">#</th>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="cursor-pointer whitespace-nowrap px-3 py-2 select-none hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center">
                      {COL_LABELS[col] ?? col}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={TABLE_COLS.length + 2}>
                    <div className="flex justify-center">
                      <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 2}>
                    {searchText ? "No matching rows." : "No GP planning rows found."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                      index % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400 dark:text-slate-500">{index + 1}</td>
                    {TABLE_COLS.map((col) => (
                      <td key={col} className="whitespace-nowrap px-3 py-2">
                        {col === "weekId" ? (
                          row.weekId ? (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              {row.weekId}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        ) : col === "scheduledStatus" ? (
                          <StatusIndicator status={row.scheduledStatus} />
                        ) : row[col] === null || row[col] === undefined || row[col] === "" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/too-management/${row.approvedTooId}`}
                          className="rounded-md bg-primary px-3 py-1 text-sm text-white hover:bg-brand-dark"
                        >
                          Details
                        </Link>
                        {/* {row.matchedObsWpId ? (
                          <Link
                            href={`/obs-wp/${row.matchedObsWpId}`}
                            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Obs
                          </Link>
                        ) : null} */}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {loading ? "" : `${displayRows.length} of ${rows.length} rows`}
        </p>
      </div>
    </main>
  );
}