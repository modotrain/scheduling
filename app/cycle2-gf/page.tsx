"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseCycleParam, getCycleLabel } from "@/app/lib/cycles";

const CYCLE2_GF_CACHE_KEY = "cycle2-gf:list:v1";
const CYCLE2_GF_CACHE_TTL_MS = 5 * 60 * 1000;
const CYCLE2_GF_DETAIL_TITLE_CACHE_KEY_PREFIX = "cycle2-gf:detail:title:";
const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

type Cycle2GfRow = {
  id: number;
  tdicId: string | null;
  sourceId: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  pi: string | null;
  userGroup: string | null;
  sourceName: string | null;
  obsType: string | null;
  ra: string | null;
  dec: string | null;
  totalExposureTime: string | null;
  exposureTimeUnit: string | null;
  continousExposure: string | null;
  visitNumber: string | null;
  exposurePerVistMin: string | null;
  exposurePerVistMax: string | null;
  completeness: string | null;
  cadence: string | null;
  cadenceUnit: string | null;
  precision: string | null;
  precisionUnit: string | null;
  startTime: string | null;
  endTime: string | null;
  sourcePriority: string | null;
  fxt1WindowMode: string | null;
  fxt1Filter: string | null;
  fxt2WindowMode: string | null;
  fxt2Filter: string | null;
  isUpdated: string | null;
  anticipatedToo: string | null;
  stp: string | null;
  category: string | null;
  type: string | null;
  payload: string | null;
  wxtCmos: string | null;
  cmosX: string | null;
  cmosY: string | null;
  fxtCmr: string | null;
  cmrX: string | null;
  cmrY: string | null;
  lastValidNomRatio: number | string | null;
  validTimeRatio: number | string | null;
};

type SortConfig = { col: keyof Cycle2GfRow | null; dir: "asc" | "desc" };

type Cycle2GfCache = {
  rows: Cycle2GfRow[];
  cachedAt: number;
};

const TABLE_COLS: (keyof Cycle2GfRow)[] = [
  "id",
  "sourceName",
//   "sourceId",
  "proposalNo",
  "pi",
//   "stp",
  "sourcePriority",
  "obsType",
  "totalExposureTime",
//   "completeness",
//   "visitNumber",
//   "cadence",
//   "validTimeRatio",
];

const COL_LABELS: Partial<Record<keyof Cycle2GfRow, string>> = {
  id: "ID",
  sourceName: "Source",
  sourceId: "Src ID",
  proposalNo: "Proposal No",
  pi: "PI",
  obsType: "Obs Type",
  ra: "RA",
  dec: "Dec",
  totalExposureTime: "Req. Exp.",
  completeness: "Completeness",
  lastValidNomRatio: "Last Obs Compl.",
  validTimeRatio: "Compl",
  stp: "STP",
  cadence: "Cadence",
  visitNumber: "Visits",
  exposureTimeUnit: "Exp. Unit",
  sourcePriority: "Priority",
  anticipatedToo: "Anticipated ToO",
};

export default function Cycle2GfPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cycle = parseCycleParam(searchParams.get("cycle"));
  const cycleQuery = `?cycle=${cycle}`;
  const cycleLabel = getCycleLabel(cycle);

  const [rows, setRows] = useState<Cycle2GfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [searchText, setSearchText] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ col: null, dir: "asc" });
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [urlStateHydrated, setUrlStateHydrated] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const pageParam = Number(searchParams.get("page") ?? "1");
    const sizeParam = Number(searchParams.get("pageSize") ?? "100");
    const sortColParam = searchParams.get("sortCol");
    const sortDirParam = searchParams.get("sortDir");
    const parsedPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const parsedPageSize = PAGE_SIZE_OPTIONS.includes(sizeParam as (typeof PAGE_SIZE_OPTIONS)[number])
      ? sizeParam
      : 100;
    const parsedSortCol =
      sortColParam && TABLE_COLS.includes(sortColParam as keyof Cycle2GfRow)
        ? (sortColParam as keyof Cycle2GfRow)
        : null;
    const parsedSortDir: "asc" | "desc" = sortDirParam === "desc" ? "desc" : "asc";

    setSearchText(q);
    setCurrentPage(parsedPage);
    setPageSize(parsedPageSize);
    setSortConfig({ col: parsedSortCol, dir: parsedSortDir });
    setUrlStateHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!urlStateHydrated) return;

    const next = new URLSearchParams(searchParams.toString());
    const nextQ = searchText.trim();

    if (nextQ) next.set("q", nextQ);
    else next.delete("q");

    if (currentPage > 1) next.set("page", String(currentPage));
    else next.delete("page");

    if (pageSize !== 100) next.set("pageSize", String(pageSize));
    else next.delete("pageSize");

    if (sortConfig.col) {
      next.set("sortCol", String(sortConfig.col));
      next.set("sortDir", sortConfig.dir);
    } else {
      next.delete("sortCol");
      next.delete("sortDir");
    }

    const currentQuery = searchParams.toString();
    const nextQuery = next.toString();
    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [urlStateHydrated, searchText, currentPage, pageSize, sortConfig, pathname, router, searchParams]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycle2-gf${cycleQuery}`, { cache: "no-store" });
      const data = (await res.json()) as { rows?: Cycle2GfRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const nextRows = data.rows ?? [];
      setRows(nextRows);
      try {
        const payload: Cycle2GfCache = { rows: nextRows, cachedAt: Date.now() };
        localStorage.setItem(`${CYCLE2_GF_CACHE_KEY}:cycle${cycle}`, JSON.stringify(payload));
      } catch {
        // Ignore localStorage errors (quota/private mode) and keep runtime state.
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [cycle, cycleQuery]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${CYCLE2_GF_CACHE_KEY}:cycle${cycle}`);
      if (raw) {
        const cache = JSON.parse(raw) as Cycle2GfCache;
        const fresh = Date.now() - cache.cachedAt < CYCLE2_GF_CACHE_TTL_MS;
        if (fresh && Array.isArray(cache.rows)) {
          setRows(cache.rows);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Ignore malformed cache and fall back to network fetch.
    }
    void loadRows();
  }, [loadRows, cycle]);

  function handleSort(col: keyof Cycle2GfRow) {
    setSortConfig((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }

  const displayRows = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    const filtered = query
      ? rows.filter((row) =>
          Object.values(row).some(
            (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(query),
          ),
        )
      : rows;

    if (!sortConfig.col) return filtered;

    const numericCols = new Set<keyof Cycle2GfRow>([
      "totalExposureTime",
      "completeness",
      "visitNumber",
      "cadence",
    ]);

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.col!] ?? "";
      const bVal = b[sortConfig.col!] ?? "";

      let cmp: number;
      if (numericCols.has(sortConfig.col!)) {
        const aNum = Number(aVal) || 0;
        const bNum = Number(bVal) || 0;
        cmp = aNum - bNum;
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, searchText, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, currentPage, pageSize]);

  function SortIcon({ col }: { col: keyof Cycle2GfRow }) {
    if (sortConfig.col !== col) {
      return <span className="ml-1 text-slate-300 dark:text-slate-600">⇅</span>;
    }
    return <span className="ml-1 text-primary">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  }

  function formatCellValue(col: keyof Cycle2GfRow, val: Cycle2GfRow[keyof Cycle2GfRow]): string {
    if (col === "lastValidNomRatio" || col === "validTimeRatio") {
      const num = typeof val === "number" ? val : Number(val);
      if (Number.isFinite(num)) {
        return num.toFixed(2);
      }
    }

    return String(val);
  }

  function cacheDetailSourceName(id: number, sourceName: string | null) {
    if (!sourceName) return;
    sessionStorage.setItem(`${CYCLE2_GF_DETAIL_TITLE_CACHE_KEY_PREFIX}${id}`, sourceName);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{cycleLabel} GF</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Browse observations. Click <strong>Details</strong> to view all fields in a new page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* <Link
              href="/too-management"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ToO Management
            </Link> */}
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Home
            </Link>
          </div>
        </div>

        {message ? (
          <p className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {message}
          </p>
        ) : null}

        <div className="mt-4">
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>
            {loading ? "" : `${displayRows.length} of ${rows.length} rows`} {loading ? "" : `(page ${currentPage}/${totalPages})`}
          </p>
          <div className="flex items-center gap-3">
            {displayRows.length > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                >
                  Prev
                </button>
                <span className="min-w-24 text-center text-xs text-slate-500 dark:text-slate-400">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-slate-300 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            ) : null}
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <th className="w-10 whitespace-nowrap px-2 py-2 text-center">#</th>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="cursor-pointer whitespace-nowrap px-2 py-2 select-none hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center">
                      {COL_LABELS[col] ?? col}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4" colSpan={TABLE_COLS.length + 2}>
                    <div className="flex justify-center">
                      <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 2}>
                    {searchText ? "No matching rows." : "No rows found."}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/70 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/35 dark:hover:bg-slate-800/70"
                  >
                    <td className="px-2 py-2 text-center font-mono text-slate-500 dark:text-slate-400">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    {TABLE_COLS.map((col) => {
                      const val = row[col];
                      const ratio =
                        col === "validTimeRatio"
                          ? typeof val === "number"
                            ? val
                            : Number(val)
                          : NaN;
                      const ratioCellClass =
                        col === "validTimeRatio" && Number.isFinite(ratio)
                          ? ratio >= 0.995
                            ? "px-2.5 py-1 rounded-md font-semibold text-primary bg-blue-50 dark:text-blue-200 dark:bg-blue-950/80"
                            : ratio >= 0.8
                              ? "px-2.5 py-1 rounded-md font-medium text-primary bg-blue-50/60 dark:text-blue-300 dark:bg-blue-950/40"
                              : ""
                          : "";
                      return (
                        <td key={col} className={`px-2 py-2 ${ratioCellClass}`}>
                          {val === null || val === undefined || val === "" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            formatCellValue(col, val)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      <Link
                        href={`/cycle2-gf/${row.id}${cycleQuery}`}
                        onClick={() => cacheDetailSourceName(row.id, row.sourceName)}
                        className="rounded-md bg-primary px-3 py-1 text-sm text-white hover:bg-brand-dark"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {displayRows.length > 0 ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
            >
              Prev
            </button>
            <span className="min-w-24 text-center text-xs text-slate-500 dark:text-slate-400">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-300 px-3 py-1 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
