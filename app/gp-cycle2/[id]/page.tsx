"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
};

type ObsListRow = {
  id: number;
  obsId: string | null;
  epDbObjectId: string | null;
  observationModeA: string | null;
  filterA: string | null;
  observationModeB: string | null;
  filterB: string | null;
  startDate: string | null;
  endDate: string | null;
  pointingDurationInOrbits: string | null;
  pointingDurationInSeconds: string | null;
  validSecs: number;
};

type ObsSortConfig = { col: keyof ObsListRow | null; dir: "asc" | "desc" };

const OBS_COLS: { key: keyof ObsListRow; label: string }[] = [
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "validSecs", label: "Valid Secs" },
  { key: "obsId", label: "Obs ID" },
  { key: "epDbObjectId", label: "EP DB Object ID" },
  { key: "observationModeA", label: "Mode A" },
  { key: "filterA", label: "Filter A" },
  { key: "observationModeB", label: "Mode B" },
  { key: "filterB", label: "Filter B" },
  { key: "pointingDurationInOrbits", label: "Obt" },
  { key: "pointingDurationInSeconds", label: "Dur (sec)" },
];

type FieldInput = Omit<GpCycle2Row, "id">;

type FieldDef = { key: keyof FieldInput; label: string };

const FIELDS: FieldDef[] = [
  { key: "tdicId", label: "TDIC ID" },
  { key: "sourceId", label: "Source ID" },
  { key: "proposalId", label: "Proposal ID" },
  { key: "proposalNo", label: "Proposal No" },
  { key: "pi", label: "PI" },
  { key: "userGroup", label: "User Group" },
  { key: "sourceName", label: "Source Name" },
  { key: "obsType", label: "Obs Type" },
  { key: "ra", label: "RA" },
  { key: "dec", label: "Dec" },
  { key: "totalExposureTime", label: "Total Exp. Time" },
  { key: "exposureTimeUnit", label: "Exp. Time Unit" },
  { key: "continousExposure", label: "Continuous Exposure" },
  { key: "visitNumber", label: "Visit Number" },
  { key: "exposurePerVistMin", label: "Exp/Visit Min" },
  { key: "exposurePerVistMax", label: "Exp/Visit Max" },
  { key: "completeness", label: "Completeness" },
  { key: "cadence", label: "Cadence" },
  { key: "cadenceUnit", label: "Cadence Unit" },
  { key: "precision", label: "Precision" },
  { key: "precisionUnit", label: "Precision Unit" },
  { key: "startTime", label: "Start Time" },
  { key: "endTime", label: "End Time" },
  { key: "sourcePriority", label: "Source Priority" },
  { key: "fxt1WindowMode", label: "FXT1 Window Mode" },
  { key: "fxt1Filter", label: "FXT1 Filter" },
  { key: "fxt2WindowMode", label: "FXT2 Window Mode" },
  { key: "fxt2Filter", label: "FXT2 Filter" },
  { key: "isUpdated", label: "Is Updated" },
  { key: "anticipatedToo", label: "Anticipated ToO" },
  { key: "stp", label: "STP" },
  { key: "category", label: "Category" },
  { key: "type", label: "Type" },
  { key: "payload", label: "Payload" },
  { key: "wxtCmos", label: "WXT CMOS" },
  { key: "cmosX", label: "CMOS X" },
  { key: "cmosY", label: "CMOS Y" },
  { key: "fxtCmr", label: "FXT CMR" },
  { key: "cmrX", label: "CMR X" },
  { key: "cmrY", label: "CMR Y" },
];

function rowToInput(row: GpCycle2Row): FieldInput {
  const { id: _id, ...rest } = row;
  void _id;
  // convert null → "" for controlled inputs
  return Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, v ?? ""]),
  ) as FieldInput;
}

const SECTIONS: Array<{ title: string; fields: Array<keyof FieldInput> }> = [
  {
    title: "Identification",
    fields: ["tdicId", "sourceId", "proposalId", "proposalNo", "pi", "userGroup", "sourceName", "obsType", "category", "type", "stp"],
  },
  {
    title: "Position & Timing",
    fields: ["ra", "dec", "startTime", "endTime"],
  },
  {
    title: "Exposure",
    fields: ["totalExposureTime", "exposureTimeUnit", "continousExposure", "visitNumber", "exposurePerVistMin", "exposurePerVistMax", "cadence", "cadenceUnit", "precision", "precisionUnit", "completeness", "sourcePriority"],
  },
  {
    title: "Instrument",
    fields: ["fxt1WindowMode", "fxt1Filter", "fxt2WindowMode", "fxt2Filter", "payload", "wxtCmos", "cmosX", "cmosY", "fxtCmr", "cmrX", "cmrY"],
  },
  {
    title: "Flags",
    fields: ["isUpdated", "anticipatedToo"],
  },
];

const FIELD_LABEL: Record<keyof FieldInput, string> = Object.fromEntries(
  FIELDS.map(({ key, label }) => [key, label]),
) as Record<keyof FieldInput, string>;

type FieldChange = { key: keyof FieldInput; label: string; before: string; after: string };

function fmtVal(v: string): string {
  return v || "—";
}

function getChanges(original: FieldInput, next: FieldInput): FieldChange[] {
  return FIELDS.flatMap(({ key, label }) => {
    const before = original[key] ?? "";
    const after = next[key] ?? "";
    if (before === after) return [];
    return [{ key, label, before: fmtVal(before), after: fmtVal(after) }];
  });
}

export default function GpCycle2DetailPage() {
  const pathname = usePathname();
  const id = pathname?.split("/").at(-1) ?? "";

  // obs list state
  const [obsList, setObsList] = useState<ObsListRow[]>([]);
  const [obsTotal, setObsTotal] = useState(0);
  const [lastValidNomRatio, setLastValidNomRatio] = useState(0);
  const [validTimeRatio, setValidTimeRatio] = useState(0);
  const [obsLoading, setObsLoading] = useState(true);
  const [onlyNonZero, setOnlyNonZero] = useState<"all" | "nonzero" | "zerosonly">("all");
  const [obsSort, setObsSort] = useState<ObsSortConfig>({ col: null, dir: "asc" });

  const [row, setRow] = useState<GpCycle2Row | null>(null);
  const [input, setInput] = useState<FieldInput>({} as FieldInput);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  function setStatus(msg: string, tone: "success" | "error") {
    setMessage(msg);
    setMessageTone(tone);
  }

  const loadObsList = useCallback(async () => {
    setObsLoading(true);
    try {
      const res = await fetch(`/api/gp-cycle2/${id}/obs-list`, { cache: "no-store" });
      const data = (await res.json()) as {
        rows?: Record<string, unknown>[];
        totalValidSecs?: number;
        lastValidNomRatio?: number;
        validTimeRatio?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load obs list");
      // normalise snake_case keys from raw SQL to camelCase
      const camel = (key: string) =>
        key.replace(/_([a-z])/g, (_m, l: string) => l.toUpperCase());
      const mapped = (data.rows ?? []).map((r) => {
        const merged: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          const ck = camel(k);
          // Keep an existing non-empty value if a duplicate key arrives as null/empty.
          const existing = merged[ck];
          const incomingEmpty = v === null || v === undefined || v === "";
          const existingPresent = existing !== null && existing !== undefined && existing !== "";
          if (existingPresent && incomingEmpty) continue;
          merged[ck] = v;
        }
        if (merged.obsId === null || merged.obsId === undefined || merged.obsId === "") {
          merged.obsId = r.obs_id ?? null;
        }
        return merged;
      }) as ObsListRow[];
      setObsList(mapped);
      setObsTotal(data.totalValidSecs ?? 0);
      setLastValidNomRatio(Number(data.lastValidNomRatio ?? 0));
      setValidTimeRatio(Number(data.validTimeRatio ?? 0));
    } catch {
      // silently ignore obs list errors — main record still loads
    } finally {
      setObsLoading(false);
    }
  }, [id]);

  const loadRow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gp-cycle2/${id}`, { cache: "no-store" });
      const data = (await res.json()) as { row?: GpCycle2Row; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      if (data.row) {
        setRow(data.row);
        setInput(rowToInput(data.row));
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRow();
    void loadObsList();
  }, [loadRow, loadObsList]);

  async function commitSave() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === "" ? null : v]),
      );
      const res = await fetch(`/api/gp-cycle2/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { row?: GpCycle2Row; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      if (data.row) {
        setRow(data.row);
        setInput(rowToInput(data.row));
      }
      setEditing(false);
      setToast({ message: "Saved successfully", tone: "success" });
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row || saving) return;
    const changes = getChanges(rowToInput(row), input);
    if (changes.length === 0) {
      setStatus("No changes to save", "success");
      return;
    }
    setPendingChanges(changes);
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setConfirmOpen(false);
    await commitSave();
  }

  function handleCancel() {
    if (row) setInput(rowToInput(row));
    setEditing(false);
    setConfirmOpen(false);
    setPendingChanges([]);
    setMessage("");
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-4 top-20 z-[80] max-w-sm rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className={toast.tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {toast.message}
          </p>
        </div>
      ) : null}

      <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">GP Cycle 2 — {row?.sourceName ?? `Record #${id}`}</h1>
            {row?.pi ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.pi}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gp-cycle2"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to list
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

        {/* ── Scheduled Observation List ─────────────────────────────── */}
        <div className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
          {/* Header row 1: stats */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50 rounded-t-lg">
            <h2 className="text-base font-semibold mr-auto">Scheduled Observation List</h2>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Total observed (sec):{" "}
              <span className="font-mono font-medium">{obsTotal.toLocaleString()}</span>
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Latest obs. compl.:{" "}
              <span className="font-mono font-medium">{lastValidNomRatio.toFixed(2)}</span>
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Total completeness:{" "}
              <span className="font-mono font-medium">{validTimeRatio.toFixed(2)}</span>
            </span>
          </div>
          {/* Header row 2: filter toggle */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/30">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span>
            <div className="flex overflow-hidden rounded-md ring-1 ring-slate-300 dark:ring-slate-600 text-xs">
              {([
                { value: "all", label: "All" },
                { value: "nonzero", label: "Non-zero only" },
                { value: "zerosonly", label: "Zero only" },
              ] as const).map(({ value, label }, idx) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOnlyNonZero(value)}
                  className={`px-3 py-1.5 transition-colors ${
                    idx > 0 ? "border-l border-slate-300 dark:border-slate-600" : ""
                  } ${
                    onlyNonZero === value
                      ? "bg-primary text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Timeline ─────────────────────────────────────────────── */}
          {(() => {
            const withStart = obsList.filter((r) => r.startDate);
            const withEnd = obsList.filter((r) => r.endDate);
            if (withStart.length === 0) return null;
            const minTime = Math.min(...withStart.map((r) => new Date(r.startDate!).getTime()));
            const maxTime = Math.max(
              ...(withEnd.length > 0 ? withEnd : withStart).map((r) =>
                new Date((r.endDate ?? r.startDate)!).getTime(),
              ),
            );
            const range = maxTime - minTime;
            if (range <= 0) return null;
            const nodes = obsList.filter((r) => r.validSecs > 0 && r.startDate);
            const fmt = (ts: number) => {
              const d = new Date(ts);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              return `${y}-${m}-${day}`;
            };
            const tickCount = 7;
            const ticks = Array.from({ length: tickCount }, (_v, i) => {
              const pct = (i / (tickCount - 1)) * 100;
              const ts = minTime + (range * i) / (tickCount - 1);
              return { pct, ts };
            });
            return (
              <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-4">
                <div className="relative mx-3 sm:mx-4">
                  {/* Track */}
                  <div className="relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    {nodes.map((r, i) => {
                      const pct = ((new Date(r.startDate!).getTime() - minTime) / range) * 100;
                      return (
                        <div
                          key={i}
                          className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                          style={{ left: `${pct}%` }}
                        >
                          <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 cursor-default transition-transform group-hover:scale-125" />
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] leading-tight text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg dark:bg-slate-700">
                            <div className="font-medium">{r.validSecs.toLocaleString()} secs</div>
                            <div className="text-slate-400 dark:text-slate-300 mt-0.5">{r.startDate}</div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
                          </div>
                        </div>
                      );
                    })}
                    {ticks.map((t) => (
                      <div
                        key={t.pct}
                        className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400/60 dark:bg-slate-500/70"
                        style={{ left: `${t.pct}%` }}
                      />
                    ))}
                  </div>
                  {/* Date labels */}
                  <div className="relative mt-2 h-5 text-[11px] md:text-xs text-slate-500 dark:text-slate-400 select-none">
                    {ticks.map((t, idx) => (
                      <span
                        key={t.ts}
                        className={`absolute whitespace-nowrap ${
                          idx === 0
                            ? "translate-x-0"
                            : idx === ticks.length - 1
                              ? "-translate-x-full"
                              : "-translate-x-1/2"
                        } ${
                          idx % 2 === 1 ? "hidden sm:inline" : "inline"
                        }`}
                        style={{ left: `${t.pct}%` }}
                      >
                        {fmt(t.ts)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  <th className="whitespace-nowrap px-3 py-2 font-medium">#</th>
                  {OBS_COLS.map(({ key, label }) => {
                    const active = obsSort.col === key;
                    return (
                      <th
                        key={key}
                        onClick={() =>
                          setObsSort((prev) => ({
                            col: key,
                            dir: prev.col === key && prev.dir === "asc" ? "desc" : "asc",
                          }))
                        }
                        className="cursor-pointer whitespace-nowrap px-3 py-2 font-medium select-none hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {active ? (
                            <span className="text-primary">
                              {obsSort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">⇅</span>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {obsLoading ? (
                  <tr>
                    <td colSpan={OBS_COLS.length + 1} className="p-0">
                      {loading ? (
                        <div className="h-2" />
                      ) : (
                        <div className="flex justify-center py-2.5">
                          <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (() => {
                  const filtered = obsList.filter((r) => {
                    if (onlyNonZero === "nonzero") return r.validSecs > 0;
                    if (onlyNonZero === "zerosonly") return r.validSecs === 0;
                    return true;
                  });
                  const sorted = obsSort.col
                    ? [...filtered].sort((a, b) => {
                        const aVal = a[obsSort.col!] ?? "";
                        const bVal = b[obsSort.col!] ?? "";
                        const cmp =
                          typeof aVal === "number" && typeof bVal === "number"
                            ? aVal - bVal
                            : String(aVal).localeCompare(String(bVal));
                        return obsSort.dir === "asc" ? cmp : -cmp;
                      })
                    : filtered;

                  if (sorted.length === 0) {
                    return (
                      <tr>
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={OBS_COLS.length + 1}>
                          No observations found.
                        </td>
                      </tr>
                    );
                  }

                  return sorted.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/70 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/35 dark:hover:bg-slate-800/70"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500 dark:text-slate-400">
                        {i + 1}
                      </td>
                      {OBS_COLS.map(({ key }) => {
                        if (key === "validSecs") {
                          return (
                            <td key={key} className="whitespace-nowrap px-3 py-2 font-mono">
                              {r.validSecs > 0 ? (
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                  {r.validSecs.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                          );
                        }
                        const val = r[key] as string | null;
                        return (
                          <td key={key} className="whitespace-nowrap px-3 py-2">
                            {val !== null && val !== undefined && val !== "" ? (
                              val
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <div className="h-2 w-28 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
          </div>
        ) : !row ? (
          <p className="mt-8 text-rose-600">Record not found.</p>
        ) : (
          <section className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="flex items-center justify-between rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <h2 className="text-base font-semibold">Record Information</h2>
              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    form="gp-detail-form"
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark"
                >
                  Edit
                </button>
              )}
            </div>

            <form id="gp-detail-form" onSubmit={handleSave}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {SECTIONS.map((section) => (
                  <div key={section.title} className="px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {section.title}
                    </p>
                    <dl className="grid grid-cols-3 gap-x-4 gap-y-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {section.fields.map((key) => {
                        const rawVal = (input[key] as string) ?? "";
                        if (editing) {
                          return (
                            <div key={key}>
                              <dt className="mb-0.5 text-[11px] text-slate-500 dark:text-slate-400">{FIELD_LABEL[key]}</dt>
                              <dd>
                                <input
                                  type="text"
                                  disabled={saving}
                                  value={rawVal}
                                  onChange={(e) =>
                                    setInput((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </dd>
                            </div>
                          );
                        }
                        const displayVal = fmtVal(rawVal);
                        return (
                          <div key={key}>
                            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{FIELD_LABEL[key]}</dt>
                            <dd className={`break-words text-xs font-medium ${
                              displayVal === "—"
                                ? "text-slate-300 dark:text-slate-600"
                                : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {displayVal}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            </form>
          </section>
        )}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm Save Changes</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {pendingChanges.length} field{pendingChanges.length !== 1 ? "s" : ""} modified. Please review before saving.
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
                  <div className="col-span-4">Field</div>
                  <div className="col-span-4">Before</div>
                  <div className="col-span-4">After</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingChanges.map((change) => (
                    <div key={change.key} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm">
                      <div className="col-span-4 font-medium text-slate-700 dark:text-slate-200">{change.label}</div>
                      <div className={`col-span-4 break-words ${
                        change.before === "—" ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"
                      }`}>{change.before}</div>
                      <div className={`col-span-4 break-words ${
                        change.after === "—" ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"
                      }`}>{change.after}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSave()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    </>
  );
}
