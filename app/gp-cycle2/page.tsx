"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type GpCycle2Row = {
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

type SortConfig = { col: keyof GpCycle2Row | null; dir: "asc" | "desc" };

const TABLE_COLS: (keyof GpCycle2Row)[] = [
  "id",
  "sourceName",
  "proposalNo",
  "pi",
  "obsType",
//   "ra",
//   "dec",
  "totalExposureTime",
//   "lastValidNomRatio",
  "validTimeRatio",
//   "exposureTimeUnit",
//   "sourcePriority",
//   "anticipatedToo",
];

const COL_LABELS: Partial<Record<keyof GpCycle2Row, string>> = {
  id: "ID",
  sourceName: "Source",
  proposalNo: "Proposal No",
  pi: "PI",
  obsType: "Obs Type",
  ra: "RA",
  dec: "Dec",
  totalExposureTime: "Request Exp.",
  lastValidNomRatio: "Last Obs Compl.",
  validTimeRatio: "Completeness",
  exposureTimeUnit: "Exp. Unit",
  sourcePriority: "Priority",
  anticipatedToo: "Anti-TOO",
};

export default function GpCycle2Page() {
  const [rows, setRows] = useState<GpCycle2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [searchText, setSearchText] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ col: null, dir: "asc" });

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gp-cycle2", { cache: "no-store" });
      const data = (await res.json()) as { rows?: GpCycle2Row[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRows(data.rows ?? []);
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

  function handleSort(col: keyof GpCycle2Row) {
    setSortConfig((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function getSortedAndFiltered(): GpCycle2Row[] {
    const query = searchText.toLowerCase().trim();
    const filtered = query
      ? rows.filter((row) =>
          Object.values(row).some(
            (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(query),
          ),
        )
      : rows;

    if (!sortConfig.col) return filtered;

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

  function SortIcon({ col }: { col: keyof GpCycle2Row }) {
    if (sortConfig.col !== col) return <span className="ml-1 text-slate-300 dark:text-slate-600">⇅</span>;
    return (
      <span className="ml-1 text-indigo-600 dark:text-indigo-400">
        {sortConfig.dir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function formatCellValue(col: keyof GpCycle2Row, val: GpCycle2Row[keyof GpCycle2Row]): string {
    if (col === "lastValidNomRatio" || col === "validTimeRatio") {
      const num = typeof val === "number" ? val : Number(val);
      if (Number.isFinite(num)) {
        return num.toFixed(2);
      }
    }

    return String(val);
  }

  const displayRows = getSortedAndFiltered();

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">GP Cycle 2</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Browse observations. Click <strong>Details</strong> to view and edit all fields in a
              new tab.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/too-req"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ToO Req
            </Link>
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Users
            </Link>
          </div>
        </div>

        {message ? (
          <p
            className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}
          >
            {message}
          </p>
        ) : null}

        <div className="mt-4">
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
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
                  <td
                    className="px-3 py-4 text-slate-500 dark:text-slate-400"
                    colSpan={TABLE_COLS.length + 1}
                  >
                    Loading…
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-4 text-slate-500 dark:text-slate-400"
                    colSpan={TABLE_COLS.length + 1}
                  >
                    {searchText ? "No matching rows." : "No rows found."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    {TABLE_COLS.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className="whitespace-nowrap px-3 py-2">
                          {val === null || val === undefined || val === "" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            formatCellValue(col, val)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <Link
                        href={`/gp-cycle2/${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
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
