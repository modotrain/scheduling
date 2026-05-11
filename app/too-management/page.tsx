"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ApprovedTooRow = {
  id: number;
  sourceName: string | null;
  proposalNo: string | null;
  pi: string | null;
  groupName: string | null;
  stp: string | null;
  requestUrgencyOfObservation: string | null;
  reviewedUrgencyOfObservation: string | null;
  receivedTime: string | null;
  reviewedTime: string | null;
  reviewedSingleExposureTime: string | null;
  reviewedNumberOfVisits: string | null;
  reviewedTotalExposureTime: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  type: string | null;
  scheduledStatus: "scheduled" | "unscheduled";
};

type SortConfig = { col: keyof ApprovedTooRow | null; dir: "asc" | "desc" };

const TABLE_COLS: (keyof ApprovedTooRow)[] = [
  "id",
  "sourceName",
  "proposalNo",
  "pi",
  "groupName",
  "stp",
  "receivedTime",
  // "requestUrgencyOfObservation",
  // "reviewedUrgencyOfObservation",
  // "reviewedTime",
  "reviewedSingleExposureTime",
  "reviewedNumberOfVisits",
  "reviewedTotalExposureTime",
  "reviewedCadence",
  // "type",
];

const STP_VALUES = ["1", "2", "3", "4", "5", "EPSC"] as const;
type StpFilter = (typeof STP_VALUES)[number] | null;

const COL_LABELS: Partial<Record<keyof ApprovedTooRow, string>> = {
  id: "ID",
  sourceName: "Source",
  proposalNo: "Proposal No",
  pi: "PI",
  groupName: "Group",
  stp: "STP",
  receivedTime: "Received",
  requestUrgencyOfObservation: "Req. Urgency",
  reviewedUrgencyOfObservation: "Rev. Urgency",
  reviewedTime: "Reviewed Time",
  reviewedSingleExposureTime: "Exp.",
  reviewedNumberOfVisits: "Visits",
  reviewedTotalExposureTime: "Total",
  reviewedCadence: "Cadence",
  // receivedTime: "Received Time",
  type: "Type",
};

function formatCadence(row: ApprovedTooRow) {
  const cadence = row.reviewedCadence?.trim() ?? "";
  const cadenceUnit = row.reviewedCadenceUnit?.trim() ?? "";

  if (cadence === "1" && !cadenceUnit) {
    return "—";
  }

  if (cadence && cadenceUnit) {
    return `${cadence} ${cadenceUnit}`;
  }

  return cadence || cadenceUnit;
}

function formatReceivedDate(value: string | null) {
  return value?.split(" ")[0] ?? "";
}

function formatGroupName(value: string | null) {
  if (!value) return "";
  return value.replace(/\s*team\s*$/i, "").trim();
}

function StatusIndicator({ status }: { status: ApprovedTooRow["scheduledStatus"] }) {
  const scheduled = status === "scheduled";

  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${scheduled ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-200/60 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300"}`}>
      {status}
    </span>
  );
}

const TOO_MANAGEMENT_CACHE_KEY = "too-management-list-cache-v1";
const TOO_MANAGEMENT_CACHE_TTL_MS = 10 * 60 * 1000;

type TooManagementCachePayload = {
  ts: number;
  rows: ApprovedTooRow[];
};

export default function TooManagementPage() {
  const [rows, setRows] = useState<ApprovedTooRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [searchText, setSearchText] = useState("");
  const [stpFilter, setStpFilter] = useState<StpFilter>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ col: null, dir: "asc" });

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const rawCache = sessionStorage.getItem(TOO_MANAGEMENT_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as TooManagementCachePayload;
        if (Date.now() - parsed.ts < TOO_MANAGEMENT_CACHE_TTL_MS) {
          setRows(parsed.rows ?? []);
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/approved-too", { cache: "no-store" });
      const data = (await res.json()) as { rows?: ApprovedTooRow[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load");
      }
      const nextRows = data.rows ?? [];
      setRows(nextRows);
      const cachePayload: TooManagementCachePayload = { ts: Date.now(), rows: nextRows };
      sessionStorage.setItem(TOO_MANAGEMENT_CACHE_KEY, JSON.stringify(cachePayload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  function handleSort(col: keyof ApprovedTooRow) {
    setSortConfig((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function getSortedAndFilteredRows() {
    const query = searchText.toLowerCase().trim();
    const filtered = rows.filter((row) => {
      if (stpFilter !== null && row.stp !== stpFilter) return false;
      if (query && !Object.values(row).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(query),
      )) return false;
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

  function SortIcon({ col }: { col: keyof ApprovedTooRow }) {
    if (sortConfig.col !== col) {
      return <span className="ml-1 text-slate-300 dark:text-slate-600">⇅</span>;
    }
    return <span className="ml-1 text-primary">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  }

  const displayRows = getSortedAndFilteredRows();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-2xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">ToO Management</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Approved ToO records with live schedule matching status. Click <strong>Details</strong> to view and edit a record.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/tootogp-schedule"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              GP Pool
            </Link>
            {/* <Link
              href="/tootogp-schedule"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              GP Pool
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

        <div className="mt-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400">STP</span>
            <div className="flex overflow-hidden rounded-md ring-1 ring-slate-300 dark:ring-slate-600 text-xs">
              <button
                onClick={() => setStpFilter(null)}
                className={`px-3 py-1.5 transition-colors ${
                  stpFilter === null
                    ? "bg-primary text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                All
              </button>
              {STP_VALUES.map((v) => (
                <button
                  key={v}
                  onClick={() => setStpFilter((prev) => (prev === v ? null : v))}
                  className={`border-l border-slate-300 px-3 py-1.5 transition-colors dark:border-slate-600 ${
                    stpFilter === v
                      ? "bg-primary text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
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
                    className={`cursor-pointer whitespace-nowrap px-3 py-2 select-none hover:bg-slate-200 dark:hover:bg-slate-700 ${
                      col === "sourceName" || col === "pi" ? "max-w-[9rem]" : ""
                    }`}
                  >
                    <span className={`flex items-center ${col === "sourceName" || col === "pi" ? "max-w-[9rem] truncate" : ""}`}>
                      {COL_LABELS[col] ?? col}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2">Status</th>
                <th className="whitespace-nowrap px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={TABLE_COLS.length + 3}>
                    <div className="flex justify-center">
                      <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 3}>
                    {searchText ? "No matching rows." : "No rows found."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                      i % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400 dark:text-slate-500">{i + 1}</td>
                    {TABLE_COLS.map((col) => {
                      const cellValue =
                        col === "reviewedCadence"
                          ? formatCadence(row)
                          : col === "groupName"
                            ? formatGroupName(row.groupName)
                          : col === "receivedTime"
                            ? formatReceivedDate(row.receivedTime)
                            : row[col];

                      return (
                        <td
                          key={col}
                          className={`whitespace-nowrap px-3 py-2 ${
                            col === "sourceName" || col === "pi" ? "max-w-[11rem]" : ""
                          }`}
                        >
                          {cellValue === null || cellValue === undefined || cellValue === "" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className={col === "sourceName" || col === "pi" ? "block max-w-[11rem] truncate" : ""}>
                              {String(cellValue)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <StatusIndicator status={row.scheduledStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/too-management/${row.id}`}
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

        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {loading ? "" : `${displayRows.length} of ${rows.length} rows`}
        </p>
      </div>
    </main>
  );
}
