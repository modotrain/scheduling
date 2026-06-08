"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ACTIVE_CYCLE, getCycleLabel } from "@/app/lib/cycles";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanSession = {
  id: number;
  weekId: string;
  status: string;
  currentStep: number;
  operatorName: string | null;
  excludedCycle2Ids: number[];
  excludedGfIds: number[];
  excludedTooGpIds: number[];
  mergedCsvText: string | null;
  uploadedObsPlanText: string | null;
  unscheduledEpDbIds: string[];
  createdAt: string;
  updatedAt: string;
};

type TooGpSourceRow = {
  id: number;
  sourceId: string | null;
  sourceName: string | null;
  pi: string | null;
  sourceType: string | null;
  completeness: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  fxtCmr: string | null;
  wxtCmos: string | null;
  generatedEpDbObjectId: string | null;
  parentEpDbObjectId: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  reviewedSingleExposureTimeSnapshot: number | null;
  reviewedNumberOfVisitsSnapshot: number | null;
  status: string | null;
  isExcluded: boolean;
};

type SourceRow = {
  id: number;
  sourceId: string | null;
  epDbObjectId: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  pi: string | null;
  groupName: string | null;
  sourceName: string | null;
  obsType: string | null;
  ra: string | null;
  dec: string | null;
  totalExposureTime: string | null;
  totalExposureTimeAll: string | null;
  visitNumber: string | null;
  exposureTimeUnit: string | null;
  sourcePriority: string | null;
  startTime: string | null;
  endTime: string | null;
  sourceType: "cycle" | "cycle2" | "gf" | "toogp";
  isExcluded: boolean;
};

type SourceStats = {
  count: number;
  totalCount: number;
  totalExposureS: number;
};

type TooGpGroupedRow = {
  key: string;
  rawIds: number[];
  sourceId: string | null;
  sourceName: string | null;
  pi: string | null;
  sourceType: string | null;
  completeness: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  fxtCmr: string | null;
  wxtCmos: string | null;
  generatedEpDbObjectId: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  totalExposureS: number;
  totalVisits: number;
};

type UnscheduledSource = {
  rowId: number;
  table: "cycle" | "cycle2" | "gf";
  sourceId: string | null;
  epDbObjectId: string | null;
  sourceName: string | null;
  obsType: string | null;
};

type UploadResult = {
  scheduledCount: number;
  mergedCount: number;
  unscheduledCount: number;
  unscheduledSources: UnscheduledSource[];
};

type WeekOption = {
  weekId: string;
  minStart: string | null;
  maxEnd: string | null;
};

type SchedulerMode = "unp-first" | "eff-first";

type SchedulerJob = {
  id: number;
  sessionId: number;
  status: string;
  mode: SchedulerMode;
  totalRuns: number;
  completedRuns: number;
  workers: number;
  bestUnp: number | null;
  bestEff: number | null;
  bestIter: number | null;
  bestCsvUrl: string | null;
  cancelRequested: boolean;
  errorMessage: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKs(seconds: number): string {
  return (seconds / 1000).toFixed(1) + " ks";
}

function formatWeekRange(minStart: string | null, maxEnd: string | null): string {
  if (!minStart) return "";
  return `${minStart.slice(0, 10)} – ${(maxEnd ?? "?").slice(0, 10)}`;
}

/** Normalize any week ID to "W42" display format (handles "42", "WK42", "W42"). */
function formatWeekId(weekId: string): string {
  const num = parseInt(weekId.replace(/\D/g, ""), 10);
  return isNaN(num) ? weekId : `W${String(num).padStart(2, "0")}`;
}

function normalizeDateOnly(value: string | null): string | null {
  if (!value) return null;
  return value.includes("T") ? value.split("T")[0] ?? null : value.split(" ")[0] ?? null;
}

function formatDateAsStartOfDay(value: string | null): string | null {
  const dateOnly = normalizeDateOnly(value);
  return dateOnly ? `${dateOnly}T00:00:00` : null;
}

function classifyTooGpObsType(sourceType: string | null, totalExposureS: number): string {
  if (sourceType === "MonitoringObs") return "GP-PPT-MT";
  if (sourceType === "SingleObs") {
    return totalExposureS <= 3000 ? "GP-PPT-ST" : "GP-PPT-LT";
  }
  return "ToO-GP";
}

function groupTooGpRows(rows: TooGpSourceRow[]): TooGpGroupedRow[] {
  const grouped = new Map<string, TooGpGroupedRow>();

  for (const row of rows) {
    // Source view: aggregate by source identity within the current session week.
    const key = row.sourceId ?? row.generatedEpDbObjectId ?? row.sourceName ?? String(row.id);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        key,
        rawIds: [row.id],
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        pi: row.pi,
        sourceType: row.sourceType,
        completeness: row.completeness,
        reviewedCadence: row.reviewedCadence,
        reviewedCadenceUnit: row.reviewedCadenceUnit,
        fxtCmr: row.fxtCmr,
        wxtCmos: row.wxtCmos,
        generatedEpDbObjectId: row.generatedEpDbObjectId,
        plannedStartTime: row.plannedStartTime,
        plannedEndTime: row.plannedEndTime,
        totalExposureS: row.reviewedSingleExposureTimeSnapshot ?? 0,
        totalVisits: row.reviewedNumberOfVisitsSnapshot ?? 0,
      });
      continue;
    }

    existing.rawIds.push(row.id);
    existing.totalExposureS += row.reviewedSingleExposureTimeSnapshot ?? 0;
    existing.totalVisits += row.reviewedNumberOfVisitsSnapshot ?? 0;

    if (row.plannedStartTime && (!existing.plannedStartTime || row.plannedStartTime < existing.plannedStartTime)) {
      existing.plannedStartTime = row.plannedStartTime;
    }
    if (row.plannedEndTime && (!existing.plannedEndTime || row.plannedEndTime > existing.plannedEndTime)) {
      existing.plannedEndTime = row.plannedEndTime;
    }
  }

  return Array.from(grouped.values());
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ["Select Week", "Cycle Sources", "GF Sources", "ToO-GP Sources", "Overview"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className={`flex flex-col items-center gap-1 px-3`}>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary text-white"
                    : active
                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`hidden text-xs sm:block ${
                  active ? "font-semibold text-primary" : done ? "text-slate-600 dark:text-slate-300" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 flex-1 sm:w-16 ${i < current ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Source table ──────────────────────────────────────────────────────────────

function SourceTable({
  rows,
  excludedIds,
  onSelectionChange,
  stats,
  loading,
  showPlanningColumns = false,
}: {
  rows: SourceRow[];
  excludedIds: Set<number>;
  onSelectionChange: (newExcluded: Set<number>) => void;
  stats: SourceStats | null;
  loading: boolean;
  showPlanningColumns?: boolean;
}) {
  const allIds = rows.map((r) => r.id);
  const selectedIds = new Set(allIds.filter((id) => !excludedIds.has(id)));
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set(allIds));
    } else {
      onSelectionChange(new Set());
    }
  };

  const toggleRow = (id: number) => {
    const next = new Set(excludedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-slate-400">Loading sources…</div>;
  }

  if (rows.length === 0) {
    return <div className="flex h-48 items-center justify-center text-slate-400">No sources found for this week.</div>;
  }

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-white">{stats.count}</strong> / {stats.totalCount} sources selected
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Total exposure: <strong className="text-slate-900 dark:text-white">{fmtKs(stats.totalExposureS)}</strong>
          </span>
          <button
            onClick={toggleAll}
            className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className={`w-full whitespace-nowrap text-xs ${showPlanningColumns ? "min-w-[1250px]" : "min-w-[980px]"}`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="cursor-pointer accent-primary"
                />
              </th>
              <th className="px-3 py-2">Source ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">PI</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Priority</th>
              {showPlanningColumns && (
                <>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2 text-right">Visits</th>
                </>
              )}
              <th className="px-3 py-2 text-right">Exp. (total)</th>
              <th className="hidden px-3 py-2 sm:table-cell">EP_DB_OBJ_ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const isSelected = !excludedIds.has(row.id);
              const expStr = row.totalExposureTimeAll ?? row.totalExposureTime ?? "—";
              const unit = row.exposureTimeUnit ?? "";
              return (
                <tr
                  key={row.id}
                  onClick={() => toggleRow(row.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      : "bg-slate-50/60 text-slate-400 line-through dark:bg-slate-900/40 dark:text-slate-600"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{row.sourceId ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-medium">{row.sourceName ?? "—"}</td>
                  <td className="max-w-[120px] truncate px-3 py-2">{row.pi ?? "—"}</td>
                  <td className="max-w-[120px] truncate px-3 py-2">{row.obsType ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.sourcePriority && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        row.sourcePriority === "A" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : row.sourcePriority === "B" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : row.sourcePriority === "C" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-slate-100 text-slate-500"
                      }`}>{row.sourcePriority}</span>
                    )}
                  </td>
                  {showPlanningColumns && (
                    <>
                      <td className="px-3 py-2 text-[11px]">{row.startTime ?? "—"}</td>
                      <td className="px-3 py-2 text-[11px]">{row.endTime ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{row.visitNumber ?? "—"}</td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right">{expStr} {unit}</td>
                  <td className="hidden max-w-[180px] truncate px-3 py-2 font-mono text-[10px] text-slate-400 sm:table-cell">{row.epDbObjectId ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TooGP source table ────────────────────────────────────────────────────────

function TooGpSourceTable({
  rows,
  excludedIds,
  onSelectionChange,
  stats,
  loading,
}: {
  rows: TooGpSourceRow[];
  excludedIds: Set<number>;
  onSelectionChange: (newExcluded: Set<number>) => void;
  stats: SourceStats | null;
  loading: boolean;
}) {
  const groupedRows = groupTooGpRows(rows);
  const selectedGroups = groupedRows.filter((g) => g.rawIds.every((id) => !excludedIds.has(id)));
  const allSelected = groupedRows.length > 0 && selectedGroups.length === groupedRows.length;
  const someSelected = selectedGroups.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      const allIds = groupedRows.flatMap((g) => g.rawIds);
      onSelectionChange(new Set(allIds));
    } else {
      onSelectionChange(new Set());
    }
  };

  const toggleGroup = (group: TooGpGroupedRow) => {
    const next = new Set(excludedIds);
    const groupSelected = group.rawIds.every((id) => !next.has(id));
    for (const id of group.rawIds) {
      if (groupSelected) next.add(id);
      else next.delete(id);
    }
    onSelectionChange(next);
  };

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-slate-400">Loading sources…</div>;
  }

  if (groupedRows.length === 0) {
    return <div className="flex h-48 items-center justify-center text-slate-400">No ToO-GP sources found for this week.</div>;
  }

  return (
    <div>
      {stats && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-white">{selectedGroups.length}</strong> / {groupedRows.length} sources selected
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Total exposure: <strong className="text-slate-900 dark:text-white">{fmtKs(selectedGroups.reduce((sum, g) => sum + g.totalExposureS, 0))}</strong>
          </span>
          <button
            onClick={toggleAll}
            className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="cursor-pointer accent-primary"
                />
              </th>
              <th className="px-3 py-2">Source ID</th>
              <th className="px-3 py-2">Source Name</th>
              <th className="px-3 py-2">PI</th>
              <th className="px-3 py-2">EP DB Object ID</th>
              <th className="px-3 py-2">Planned Window</th>
              <th className="px-3 py-2 text-right">Total Exp.</th>
              <th className="px-3 py-2 text-right">Visits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {groupedRows.map((group) => {
              const isSelected = group.rawIds.every((id) => !excludedIds.has(id));
              return (
                <tr
                  key={group.key}
                  onClick={() => toggleGroup(group)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      : "bg-slate-50/60 text-slate-400 line-through dark:bg-slate-900/40 dark:text-slate-600"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGroup(group)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="font-mono text-[11px] text-slate-500">{group.sourceId ?? "—"}</td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-medium">{group.sourceName ?? "—"}</td>
                  <td className="max-w-[100px] truncate px-3 py-2">{group.pi ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{group.generatedEpDbObjectId ?? "—"}</td>
                  <td className="px-3 py-2 text-[11px]">
                    {group.plannedStartTime ?? "—"} → {group.plannedEndTime ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtKs(group.totalExposureS)}
                  </td>
                  <td className="px-3 py-2 text-right">{group.totalVisits}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WizardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const cycleLabel = getCycleLabel(ACTIVE_CYCLE);
  const [sessionId, setSessionId] = useState<number>(0);
  const [session, setSession] = useState<PlanSession | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Step 2 & 3 data
  const [cycle2Rows, setCycle2Rows] = useState<SourceRow[]>([]);
  const [cycle2Stats, setCycle2Stats] = useState<SourceStats | null>(null);
  const [cycle2Loading, setCycle2Loading] = useState(false);
  const [cycle2Loaded, setCycle2Loaded] = useState(false);
  const [excludedCycle2, setExcludedCycle2] = useState<Set<number>>(new Set());

  const [gfRows, setGfRows] = useState<SourceRow[]>([]);
  const [gfStats, setGfStats] = useState<SourceStats | null>(null);
  const [gfLoading, setGfLoading] = useState(false);
  const [gfLoaded, setGfLoaded] = useState(false);
  const [excludedGf, setExcludedGf] = useState<Set<number>>(new Set());

  const [tooGpRows, setTooGpRows] = useState<TooGpSourceRow[]>([]);
  const [tooGpStats, setTooGpStats] = useState<SourceStats | null>(null);
  const [tooGpLoading, setTooGpLoading] = useState(false);
  const [tooGpLoaded, setTooGpLoaded] = useState(false);
  const [excludedTooGp, setExcludedTooGp] = useState<Set<number>>(new Set());

  // Post-confirm
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [reassigning, setReassigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState<WeekOption[]>([]);

  // Nav saving state
  const [saving, setSaving] = useState(false);
  const [returnToOverviewAfterSave, setReturnToOverviewAfterSave] = useState(false);

  // Scheduler state
  const [schedulerJob, setSchedulerJob] = useState<SchedulerJob | null>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerStarting, setSchedulerStarting] = useState(false);
  const [schedulerMode, setSchedulerMode] = useState<SchedulerMode>("unp-first");
  const [schedulerRuns, setSchedulerRuns] = useState(1000);
  const [schedulerWorkers, setSchedulerWorkers] = useState(4);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    void params.then((p) => {
      const id = parseInt(p.id, 10);
      setSessionId(id);
    });
  }, [params]);

  const loadSession = useCallback(async (id: number) => {
    setSessionLoading(true);
    try {
      const res = await fetch(`/api/short-term-plan/sessions/${id}`);
      if (!res.ok) { router.push("/short-term-planning"); return; }
      const data = (await res.json()) as { session: PlanSession };
      const s = data.session;
      setSession(s);
      setCycle2Rows([]);
      setGfRows([]);
      setTooGpRows([]);
      setCycle2Stats(null);
      setGfStats(null);
      setTooGpStats(null);
      setCycle2Loaded(false);
      setGfLoaded(false);
      setTooGpLoaded(false);
      setExcludedCycle2(new Set(s.excludedCycle2Ids));
      setExcludedGf(new Set(s.excludedGfIds));
      setExcludedTooGp(new Set(s.excludedTooGpIds ?? []));

      // Restore step from status (confirmed/uploaded/completed always go to overview)
      // For active sessions, restore the persisted step from DB
      if (s.status === "uploaded" || s.status === "completed" || s.status === "confirmed") {
        setCurrentStep(4);
      } else {
        setCurrentStep(s.currentStep ?? 0);
      }

      // Restore upload result if session has unscheduled sources
      if ((s.status === "uploaded" || s.status === "completed") && s.unscheduledEpDbIds.length >= 0 && s.uploadedObsPlanText) {
        // We'll reconstruct the unscheduled list from the sources endpoint
      }
    } finally {
      setSessionLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (sessionId) void loadSession(sessionId);
  }, [sessionId, loadSession]);

  useEffect(() => {
    void fetch("/api/short-term-plan/weeks")
      .then((r) => r.json())
      .then((d: { weeks: WeekOption[] }) => setAvailableWeeks(d.weeks ?? []));
  }, []);

  const loadSchedulerJob = useCallback(async () => {
    if (!session) return;
    setSchedulerLoading(true);
    try {
      const res = await fetch(`/api/short-term-plan/sessions/${session.id}/scheduler`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: SchedulerJob | null };
      setSchedulerJob(data.job ?? null);
    } finally {
      setSchedulerLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void loadSchedulerJob();
  }, [session, loadSchedulerJob]);

  useEffect(() => {
    if (!session || !schedulerJob) return;
    if (!["starting", "running", "cancelling"].includes(schedulerJob.status)) return;

    const timer = setInterval(() => {
      void loadSchedulerJob();
    }, 1500);
    return () => clearInterval(timer);
  }, [session, schedulerJob, loadSchedulerJob]);

  // ── Load sources on step change ──────────────────────────────────────────

  useEffect(() => {
    if ((currentStep === 1 || currentStep === 4) && session && cycle2Rows.length === 0) {
      setCycle2Loading(true);
      fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=cycle`)
        .then((r) => r.json())
        .then((d: { rows: SourceRow[]; stats: SourceStats }) => {
          setCycle2Rows(d.rows ?? []);
          setCycle2Stats(d.stats);
          setExcludedCycle2(new Set(session.excludedCycle2Ids));
        })
        .catch(console.error)
        .finally(() => {
          setCycle2Loading(false);
          setCycle2Loaded(true);
        });
    }
  }, [currentStep, session, cycle2Rows.length]);

  useEffect(() => {
    if ((currentStep === 2 || currentStep === 4) && session && gfRows.length === 0) {
      setGfLoading(true);
      fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=gf`)
        .then((r) => r.json())
        .then((d: { rows: SourceRow[]; stats: SourceStats }) => {
          setGfRows(d.rows ?? []);
          setGfStats(d.stats);
          setExcludedGf(new Set(session.excludedGfIds));
        })
        .catch(console.error)
        .finally(() => {
          setGfLoading(false);
          setGfLoaded(true);
        });
    }
  }, [currentStep, session, gfRows.length]);

  // Recalculate stats when exclusion changes
  useEffect(() => {
    if (!cycle2Rows.length) return;
    const included = cycle2Rows.filter((r) => !excludedCycle2.has(r.id));
    const totalExposureS = included.reduce((sum, r) => {
      const v = parseFloat(r.totalExposureTimeAll ?? r.totalExposureTime ?? "0");
      const unit = r.exposureTimeUnit?.toLowerCase() ?? "";
      return sum + (unit === "ks" ? v * 1000 : unit === "hr" ? v * 3600 : v);
    }, 0);
    setCycle2Stats({ count: included.length, totalCount: cycle2Rows.length, totalExposureS: Math.round(totalExposureS) });
  }, [excludedCycle2, cycle2Rows]);

  useEffect(() => {
    if (!gfRows.length) return;
    const included = gfRows.filter((r) => !excludedGf.has(r.id));
    const totalExposureS = included.reduce((sum, r) => {
      const v = parseFloat(r.totalExposureTimeAll ?? r.totalExposureTime ?? "0");
      const unit = r.exposureTimeUnit?.toLowerCase() ?? "";
      return sum + (unit === "ks" ? v * 1000 : unit === "hr" ? v * 3600 : v);
    }, 0);
    setGfStats({ count: included.length, totalCount: gfRows.length, totalExposureS: Math.round(totalExposureS) });
  }, [excludedGf, gfRows]);

  useEffect(() => {
    if (!tooGpRows.length) return;
    const included = tooGpRows.filter((r) => !excludedTooGp.has(r.id));
    const totalExposureS = included.reduce((sum, r) => sum + (r.reviewedSingleExposureTimeSnapshot ?? 0), 0);
    setTooGpStats({ count: included.length, totalCount: tooGpRows.length, totalExposureS });
  }, [excludedTooGp, tooGpRows]);

  useEffect(() => {
    if ((currentStep === 3 || currentStep === 4) && session && tooGpRows.length === 0) {
      setTooGpLoading(true);
      fetch(`/api/short-term-plan/sessions/${session.id}/too-gp-sources`)
        .then((r) => r.json())
        .then((d: { rows: TooGpSourceRow[]; stats: SourceStats }) => {
          setTooGpRows(d.rows ?? []);
          setTooGpStats(d.stats);
          setExcludedTooGp(new Set(session.excludedTooGpIds ?? []));
        })
        .catch(console.error)
        .finally(() => {
          setTooGpLoading(false);
          setTooGpLoaded(true);
        });
    }
  }, [currentStep, session, tooGpRows.length]);

  // ── Load unscheduled if session was already uploaded ──────────────────────

  useEffect(() => {
    if (!session) return;
    if (session.status !== "uploaded" && session.status !== "completed") return;
    if (uploadResult) return;
    if (!session.unscheduledEpDbIds.length && !session.uploadedObsPlanText) return;

    // Reconstruct unscheduled list from cycle2 rows only (GF not tracked)
    const loadUnscheduled = async () => {
      const [c2Res, gfRes] = await Promise.all([
        fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=cycle`),
        fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=gf`),
      ]);
      const c2Data = (await c2Res.json()) as { rows: SourceRow[] };
      const gfData = (await gfRes.json()) as { rows: SourceRow[] };
      const unscheduledSet = new Set(session.unscheduledEpDbIds);
      const unscheduled: UnscheduledSource[] = [
        ...c2Data.rows.filter((r) => !r.isExcluded && r.epDbObjectId && unscheduledSet.has(r.epDbObjectId))
          .map((r) => ({ rowId: r.id, table: "cycle" as const, sourceId: r.sourceId, epDbObjectId: r.epDbObjectId, sourceName: r.sourceName, obsType: r.obsType })),
        // GF is intentionally excluded from unscheduled tracking
      ];
      if (cycle2Rows.length === 0) { setCycle2Rows(c2Data.rows ?? []); }
      if (gfRows.length === 0) { setGfRows(gfData.rows ?? []); }
      const cycle2Included = (c2Data.rows ?? []).filter((r) => !r.isExcluded);
      setUploadResult({
        scheduledCount: cycle2Included.length - unscheduled.length,
        mergedCount: cycle2Included.length,
        unscheduledCount: unscheduled.length,
        unscheduledSources: unscheduled,
      });
    };
    void loadUnscheduled();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  async function saveAndNext() {
    if (!session) return;
    setSaving(true);
    try {
      if (currentStep === 0) {
        // Save step advance (no source data to persist yet)
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStep: 1 }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(1);
      } else if (currentStep === 1) {
        const nextStep = returnToOverviewAfterSave ? 4 : 2;
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludedCycle2Ids: [...excludedCycle2], currentStep: nextStep }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(nextStep);
        setReturnToOverviewAfterSave(false);
      } else if (currentStep === 2) {
        const nextStep = returnToOverviewAfterSave ? 4 : 3;
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludedGfIds: [...excludedGf], currentStep: nextStep }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(nextStep);
        setReturnToOverviewAfterSave(false);
      } else if (currentStep === 3) {
        const nextStep = returnToOverviewAfterSave ? 4 : 4;
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludedTooGpIds: [...excludedTooGp], currentStep: nextStep }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(nextStep);
        setReturnToOverviewAfterSave(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!session) return;
    setSaving(true);
    try {
      // Freeze CSV content before confirming so future downloads stay immutable.
      const freezeRes = await fetch(`/api/short-term-plan/sessions/${session.id}/download-csv`);
      if (!freezeRes.ok) {
        alert("Failed to generate locked CSV. Please try again.");
        return;
      }

      const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (!res.ok) { alert("Failed to confirm."); return; }
      const data = (await res.json()) as { session: PlanSession };
      setSession(data.session);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadCsv() {
    if (!session) return;
    // Save excluded IDs before generating CSV
    await fetch(`/api/short-term-plan/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        excludedCycle2Ids: [...excludedCycle2],
        excludedGfIds: [...excludedGf],
        excludedTooGpIds: [...excludedTooGp],
      }),
    });
    const link = document.createElement("a");
    link.href = `/api/short-term-plan/sessions/${session.id}/download-csv`;
    link.click();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/short-term-plan/sessions/${session.id}/upload-obs-plan`, {
        method: "POST",
        body: formData,
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = (await res.json()) as UploadResult & { error?: string };
      if (data.error) { alert(`Upload error: ${data.error}`); return; }
      setUploadResult(data);
      setSession((prev) => prev ? { ...prev, status: "uploaded" } : prev);
      // Initialize assignments with current weekId as default
      const defaults: Record<number, string> = {};
      for (const s of data.unscheduledSources) {
        defaults[s.rowId] = availableWeeks.find((w) => w.weekId !== session.weekId)?.weekId ?? session.weekId;
      }
      setAssignments(defaults);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReassign() {
    if (!session || !uploadResult) return;
    const toAssign = uploadResult.unscheduledSources.filter((s) => assignments[s.rowId]);
    if (toAssign.length === 0) { alert("No sources to reassign."); return; }
    setReassigning(true);
    try {
      const res = await fetch(`/api/short-term-plan/sessions/${session.id}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: toAssign.map((s) => ({ rowId: s.rowId, table: s.table, newWeekId: assignments[s.rowId] })),
        }),
      });
      if (!res.ok) { alert("Failed to reassign. Please try again."); return; }
      setSession((prev) => prev ? { ...prev, status: "completed" } : prev);
      alert(`Done! ${toAssign.length} source(s) reassigned to new weeks.`);
    } finally {
      setReassigning(false);
    }
  }

  async function handleCancelUpload() {
    if (!session) return;
    if (!confirm("Cancel upload and revert all week_id changes?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/short-term-plan/sessions/${session.id}/cancel-upload`, {
        method: "POST",
      });
      if (!res.ok) { alert("Failed to cancel."); return; }
      setUploadResult(null);
      setAssignments({});
      setSession((prev) => prev ? { ...prev, status: "confirmed", uploadedObsPlanText: null, unscheduledEpDbIds: [] } : prev);
    } finally {
      setCancelling(false);
    }
  }

  async function handleRunScheduler() {
    if (!session) return;
    setSchedulerStarting(true);
    try {
      const res = await fetch(`/api/short-term-plan/sessions/${session.id}/scheduler/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: schedulerMode,
          totalRuns: schedulerRuns,
          workers: schedulerWorkers,
        }),
      });
      const data = (await res.json()) as { job?: SchedulerJob; error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to start scheduler");
        return;
      }
      if (data.job) {
        setSchedulerJob(data.job);
      }
    } finally {
      setSchedulerStarting(false);
    }
  }

  async function handleCancelScheduler() {
    if (!session) return;
    const res = await fetch(`/api/short-term-plan/sessions/${session.id}/scheduler/cancel`, {
      method: "POST",
    });
    const data = (await res.json()) as { job?: SchedulerJob; error?: string };
    if (!res.ok) {
      alert(data.error ?? "Failed to cancel scheduler");
      return;
    }
    if (data.job) {
      setSchedulerJob(data.job);
    }
  }

  // Allow re-editing steps 2/3/4 from overview
  function goBackToStep(step: number) {
    if (isConfirmed) return;
    setReturnToOverviewAfterSave(true);
    setCurrentStep(step);
    if (session) {
      void fetch(`/api/short-term-plan/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: step }),
      });
    }
    // Force reload of source data
    if (step === 1) {
      setCycle2Rows([]);
      setCycle2Loaded(false);
    }
    if (step === 2) {
      setGfRows([]);
      setGfLoaded(false);
    }
    if (step === 3) {
      setTooGpRows([]);
      setTooGpLoaded(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400">Loading session…</div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Session not found.</p>
        <Link href="/short-term-planning" className="text-sm text-primary underline">Back to sessions</Link>
      </main>
    );
  }

  const isConfirmed = ["confirmed", "uploaded", "completed"].includes(session.status);
  const isUploaded = session.status === "uploaded" || session.status === "completed";
  const isCompleted = session.status === "completed";

  // Merged stats for step 5 (Overview)
  const cycle2Included = cycle2Rows.filter((r) => !excludedCycle2.has(r.id));
  const gfIncluded = gfRows.filter((r) => !excludedGf.has(r.id));
  const tooGpIncluded = tooGpRows.filter((r) => !excludedTooGp.has(r.id));
  const tooGpGroupedIncluded = groupTooGpRows(tooGpIncluded);
  // Sort cycle2 and merge with ToO-GP: cycle A, then ToO-GP A, then cycle B, then others, then GF
  const cycle2A = cycle2Included.filter((r) => r.sourcePriority === "A");
  const cycle2B = cycle2Included.filter((r) => r.sourcePriority === "B");
  const cycle2Other = cycle2Included.filter((r) => r.sourcePriority !== "A" && r.sourcePriority !== "B");
  // Convert TooGpSourceRow to compatible format and merge
  const tooGpConverted = tooGpGroupedIncluded.map((r, index) => ({
    id: 900000 + index,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    pi: r.pi,
    sourceType: "toogp" as const,
    epDbObjectId: r.generatedEpDbObjectId,
    proposalId: null as string | null,
    proposalNo: null as string | null,
    groupName: null as string | null,
    obsType: classifyTooGpObsType(r.sourceType, r.totalExposureS),
    ra: null as string | null,
    dec: null as string | null,
    totalExposureTime: String(r.totalExposureS),
    totalExposureTimeAll: String(r.totalExposureS),
    exposureTimeUnit: "second",
    continousExposure: null,
    visitNumber: String(r.totalVisits),
    exposurePerVistMin: null,
    exposurePerVistMax: null,
    completeness: r.completeness,
    cadence: r.reviewedCadence,
    cadenceUnit: r.reviewedCadenceUnit,
    precision: null,
    precisionUnit: null,
    sourcePriority: "A",
    startTime: formatDateAsStartOfDay(r.plannedStartTime),
    endTime: formatDateAsStartOfDay(r.plannedEndTime),
    fxt1WindowMode: null,
    fxt1Filter: null,
    fxt2WindowMode: null,
    fxt2Filter: null,
    isUpdated: null,
    payload: null,
    wxtCmos: r.wxtCmos,
    wxtCmosX: null,
    wxtCmosY: null,
    fxtCmr: r.fxtCmr,
    fxtX: null,
    fxtY: null,
    isForDisrupted: "false",
    isExcluded: false,
  }));
  const mergedAll: SourceRow[] = [...cycle2A, ...tooGpConverted, ...cycle2B, ...cycle2Other, ...gfIncluded];

  function calcExpS(rows: SourceRow[]) {
    return rows.reduce((sum, r) => {
      const v = parseFloat(r.totalExposureTimeAll ?? r.totalExposureTime ?? "0");
      const unit = r.exposureTimeUnit?.toLowerCase() ?? "";
      return sum + (unit === "ks" ? v * 1000 : unit === "hr" ? v * 3600 : v);
    }, 0);
  }
  const cycle2ExpS = calcExpS(cycle2Included);
  const gfExpS = calcExpS(gfIncluded);
  const tooGpExpS = tooGpGroupedIncluded.reduce((sum, r) => sum + r.totalExposureS, 0);
  const mergedExpS = cycle2ExpS + gfExpS + tooGpExpS;
  const overviewCardsLoading = currentStep === 4 && (!cycle2Loaded || !gfLoaded || !tooGpLoaded);
  const schedulerProgressPct = schedulerJob && schedulerJob.totalRuns > 0
    ? Math.min(100, Math.round((schedulerJob.completedRuns / schedulerJob.totalRuns) * 100))
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 dark:from-slate-950 dark:to-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/short-term-planning" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← All Sessions
          </Link>
          <div className="flex flex-wrap items-start gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Short-Term Planning · {formatWeekId(session.weekId)}
            </h1>
            <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isCompleted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : isUploaded ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : isConfirmed ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            }`}>
              {isCompleted ? "Completed" : isUploaded ? "Uploaded" : isConfirmed ? "Confirmed" : "In Progress"}
            </span>
          </div>
          {session.operatorName && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Operator: {session.operatorName}</p>
          )}
        </div>

        {/* Step bar */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <StepBar current={currentStep} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">

          {/* Step 1: Week info */}
          {currentStep === 0 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Step 1: Confirm Week Selection</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Selected Week</p>
                  <p className="text-2xl font-bold text-primary">{formatWeekId(session.weekId)}</p>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Operator</p>
                  <p className="text-base font-medium text-slate-800 dark:text-slate-200">{session.operatorName ?? "—"}</p>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                This session will load sources from <strong>{cycleLabel} Long-Term</strong> and <strong>{cycleLabel}-GF</strong> tables for week <strong>{formatWeekId(session.weekId)}</strong>. Click Next to proceed.
              </p>
            </div>
          )}

          {/* Step 2: cycle sources */}
          {currentStep === 1 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Step 2: {cycleLabel} Long-Term Sources</h2>
                <span className="text-xs text-slate-500">Week: {formatWeekId(session.weekId)}</span>
              </div>
              <SourceTable
                rows={cycle2Rows}
                excludedIds={excludedCycle2}
                onSelectionChange={setExcludedCycle2}
                stats={cycle2Stats}
                loading={cycle2Loading}
                showPlanningColumns
              />
            </div>
          )}

          {/* Step 3: GF sources */}
          {currentStep === 2 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Step 3: {cycleLabel}-GF Sources</h2>
                <span className="text-xs text-slate-500">Week: {formatWeekId(session.weekId)}</span>
              </div>
              <SourceTable
                rows={gfRows}
                excludedIds={excludedGf}
                onSelectionChange={setExcludedGf}
                stats={gfStats}
                loading={gfLoading}
              />
            </div>
          )}

          {/* Step 4: ToO-GP sources */}
          {currentStep === 3 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Step 4: ToO-GP Sources</h2>
                <span className="text-xs text-slate-500">Week: {formatWeekId(session.weekId)}</span>
              </div>
              <TooGpSourceTable
                rows={tooGpRows}
                excludedIds={excludedTooGp}
                onSelectionChange={setExcludedTooGp}
                stats={tooGpStats}
                loading={tooGpLoading}
              />
            </div>
          )}

          {/* Step 5: Overview */}
          {currentStep === 4 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Step 5: Overview & Confirm</h2>

              {/* Stats summary */}
              {overviewCardsLoading && (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Loading source summary…</p>
              )}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  { label: "Total Sources", value: mergedAll.length },
                  { label: `${cycleLabel} Sources`, value: cycle2Included.length },
                  { label: "GF Sources", value: gfIncluded.length },
                  { label: "ToO-GP Sources", value: tooGpGroupedIncluded.length },
                  { label: `${cycleLabel} Exposure`, value: fmtKs(cycle2ExpS) },
                  { label: "GF Exposure", value: fmtKs(gfExpS) },
                  { label: "ToO-GP Exposure", value: fmtKs(tooGpExpS) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                      {overviewCardsLoading ? (
                        <span className="inline-block h-7 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      ) : stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Modify selections links */}
              <div className="mb-4 flex flex-wrap gap-3">
                {!isConfirmed ? (
                  <>
                    <button onClick={() => goBackToStep(1)} className="text-xs text-primary underline-offset-2 hover:underline">
                      ✏ Modify {cycleLabel} selection
                    </button>
                    <button onClick={() => goBackToStep(2)} className="text-xs text-primary underline-offset-2 hover:underline">
                      ✏ Modify GF selection
                    </button>
                    <button onClick={() => goBackToStep(3)} className="text-xs text-primary underline-offset-2 hover:underline">
                      ✏ Modify ToO-GP selection
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Source selection is locked after confirmation.
                  </span>
                )}
              </div>

              {/* Merged table preview (first 50 rows) */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Source ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">PI</th>
                      <th className="px-3 py-2">Obs Type</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Start</th>
                      <th className="px-3 py-2">End</th>
                      <th className="px-3 py-2 text-right">Visits</th>
                      <th className="px-3 py-2 text-right">Total Exp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mergedAll.slice(0, 50).map((row) => (
                      <tr key={`${row.sourceType}-${row.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            row.sourceType === "gf"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : row.sourceType === "toogp"
                                ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                                : "bg-primary/10 text-primary"
                              }`}>{row.sourceType === "gf" ? "GF" : row.sourceType === "toogp" ? "ToGP" : `C${ACTIVE_CYCLE}`}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{row.sourceId ?? "—"}</td>
                        <td className="max-w-[130px] truncate px-3 py-1.5">{row.sourceName ?? "—"}</td>
                        <td className="px-3 py-1.5">{row.pi ?? "—"}</td>
                        <td className="px-3 py-1.5 text-[10px]">{row.obsType ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          {row.sourcePriority && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              row.sourcePriority === "A" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : row.sourcePriority === "B" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                            }`}>{row.sourcePriority}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-[10px]">{row.startTime ?? "—"}</td>
                        <td className="px-3 py-1.5 text-[10px]">{row.endTime ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right">{row.visitNumber ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right">
                          {(() => {
                            const val = row.totalExposureTimeAll ?? row.totalExposureTime;
                            if (!val) return "—";
                            const num = parseFloat(val);
                            const unit = (row.exposureTimeUnit ?? "").toLowerCase();
                            const seconds = unit === "ks" ? num * 1000 : unit === "hr" ? num * 3600 : num;
                            return fmtKs(seconds);
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mergedAll.length > 50 && (
                  <p className="px-3 py-2 text-center text-xs text-slate-400">… and {mergedAll.length - 50} more rows in the downloaded CSV</p>
                )}
              </div>

              {/* Confirm + Download actions */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void handleDownloadCsv()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                >
                  ↓ Download Merged CSV
                </button>
                {!isConfirmed && (
                  <button
                    onClick={() => void handleConfirm()}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Confirm & Proceed →"}
                  </button>
                )}
                {isConfirmed && (
                  <span className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    ✓ Confirmed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-4 flex justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← Previous
          </button>
          {currentStep < 4 && (
            <button
              onClick={() => void saveAndNext()}
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : returnToOverviewAfterSave ? "Save & Return to Overview" : "Next →"}
            </button>
          )}
        </div>

        {/* ── Post-confirm section ─────────────────────────────────────────────── */}
        {isConfirmed && currentStep === 4 && (
          <div className="mt-6 space-y-4">
            {/* Upload / Scheduler panel */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Scheduling Integration</h3>
              <div className="flex flex-wrap items-center gap-3">
                {/* Upload button */}
                {!isUploaded && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => void handleFileUpload(e)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {uploading ? "Uploading…" : "↑ Upload Scheduling Result CSV"}
                    </button>
                  </>
                )}

                {/* Run Scheduler */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <label className="text-xs text-slate-500">Mode</label>
                  <select
                    value={schedulerMode}
                    onChange={(e) => setSchedulerMode(e.target.value as SchedulerMode)}
                    disabled={schedulerStarting || (schedulerJob ? ["starting", "running", "cancelling"].includes(schedulerJob.status) : false)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="unp-first">unp-first</option>
                    <option value="eff-first">eff-first</option>
                  </select>

                  <label className="text-xs text-slate-500">Runs</label>
                  <input
                    type="number"
                    min={1}
                    max={200000}
                    value={schedulerRuns}
                    onChange={(e) => setSchedulerRuns(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    disabled={schedulerStarting || (schedulerJob ? ["starting", "running", "cancelling"].includes(schedulerJob.status) : false)}
                    className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  />

                  <label className="text-xs text-slate-500">Workers</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={schedulerWorkers}
                    onChange={(e) => setSchedulerWorkers(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    disabled={schedulerStarting || (schedulerJob ? ["starting", "running", "cancelling"].includes(schedulerJob.status) : false)}
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  />

                  <button
                    onClick={() => void handleRunScheduler()}
                    disabled={schedulerStarting || (schedulerJob ? ["starting", "running", "cancelling"].includes(schedulerJob.status) : false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                  >
                    {schedulerStarting ? "Starting…" : "▶ Run Scheduler"}
                  </button>

                  {schedulerJob && ["starting", "running", "cancelling"].includes(schedulerJob.status) && (
                    <button
                      onClick={() => void handleCancelScheduler()}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    >
                      Request Cancel
                    </button>
                  )}
                </div>

                {/* Upload result summary */}
                {uploadResult && (
                  <div className="ml-auto flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                    <span className="text-green-600 dark:text-green-400">✓ {uploadResult.scheduledCount} scheduled</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-amber-600 dark:text-amber-400">⚠ {uploadResult.unscheduledCount} unscheduled</span>
                    <span className="text-slate-400">out of {uploadResult.mergedCount}</span>
                    {!isCompleted && (
                      <button
                        onClick={() => void handleCancelUpload()}
                        disabled={cancelling}
                        className="ml-1 text-red-500 underline-offset-1 hover:underline disabled:opacity-40"
                      >
                        {cancelling ? "Reverting…" : "Cancel Upload"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-2 flex flex-wrap items-center gap-4">
                  <span>
                    Scheduler: <strong className="text-slate-900 dark:text-white">{schedulerLoading ? "loading" : (schedulerJob?.status ?? "idle")}</strong>
                  </span>
                  <span>
                    Mode: <strong className="text-slate-900 dark:text-white">{schedulerJob?.mode ?? schedulerMode}</strong>
                  </span>
                  <span>
                    Progress: <strong className="text-slate-900 dark:text-white">{schedulerJob ? `${schedulerJob.completedRuns}/${schedulerJob.totalRuns}` : "0/0"}</strong>
                  </span>
                  {schedulerJob?.bestUnp != null && (
                    <span>
                      Best: <strong className="text-slate-900 dark:text-white">unp={schedulerJob.bestUnp}</strong>, eff=<strong className="text-slate-900 dark:text-white">{schedulerJob.bestEff?.toFixed(4) ?? "—"}</strong>
                    </span>
                  )}
                  {schedulerJob?.bestIter != null && (
                    <span>
                      iter: <strong className="text-slate-900 dark:text-white">{schedulerJob.bestIter}</strong>
                    </span>
                  )}
                  {schedulerJob?.bestCsvUrl && (
                    <a href={schedulerJob.bestCsvUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                      Download best CSV
                    </a>
                  )}
                </div>

                <div className="h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                  <div className="h-full bg-primary transition-all" style={{ width: `${schedulerProgressPct}%` }} />
                </div>

                {schedulerJob?.errorMessage && (
                  <p className="mt-2 text-red-600 dark:text-red-400">{schedulerJob.errorMessage}</p>
                )}
              </div>
            </div>

            {/* Unscheduled sources panel */}
            {uploadResult && uploadResult.unscheduledCount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-800/40 dark:bg-amber-900/10">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Unscheduled Sources ({uploadResult.unscheduledCount})
                  </h3>
                  {!isCompleted && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          // Set all assignments to the next available week
                          const nextWeek = availableWeeks.find((w) => w.weekId !== session.weekId)?.weekId ?? session.weekId;
                          const bulk: Record<number, string> = {};
                          for (const s of uploadResult.unscheduledSources) bulk[s.rowId] = nextWeek;
                          setAssignments(bulk);
                        }}
                        className="text-xs text-primary underline-offset-1 hover:underline"
                      >
                        Set all to next week
                      </button>
                      <button
                        onClick={() => void handleReassign()}
                        disabled={reassigning || isCompleted}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {reassigning ? "Saving…" : "Confirm Reassignment"}
                      </button>
                    </div>
                  )}
                </div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  These sources were not found in the uploaded scheduling result. Assign them to a future week to keep them in the plan.
                </p>
                <div className="overflow-x-auto rounded-lg border border-amber-200/60 dark:border-amber-800/30">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-amber-200/60 bg-amber-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-slate-400">
                        <th className="px-3 py-2">Cycle</th>
                        <th className="px-3 py-2">Source ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Current Week</th>
                        <th className="px-3 py-2">Assign to Week</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/20">
                      {uploadResult.unscheduledSources.map((s) => (
                        <tr key={`${s.table}-${s.rowId}`} className="bg-white dark:bg-slate-900/60">
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              s.table === "gf"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-primary/10 text-primary"
                            }`}>{s.table === "gf" ? "GF" : "C2"}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">{s.sourceId ?? "—"}</td>
                          <td className="max-w-[130px] truncate px-3 py-2 font-medium">{s.sourceName ?? "—"}</td>
                          <td className="px-3 py-2 text-[10px]">{s.obsType ?? "—"}</td>
                          <td className="px-3 py-2 font-mono">{formatWeekId(session.weekId)}</td>
                          <td className="px-3 py-2">
                            {isCompleted ? (
                              <span className="font-mono text-green-600 dark:text-green-400">{assignments[s.rowId] ?? "—"}</span>
                            ) : (
                              <select
                                value={assignments[s.rowId] ?? ""}
                                onChange={(e) => setAssignments((prev) => ({ ...prev, [s.rowId]: e.target.value }))}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                              >
                                <option value="">— skip —</option>
                                {availableWeeks.filter((w) => w.weekId !== session.weekId).map((w) => (
                                  <option key={w.weekId} value={w.weekId}>{formatWeekId(w.weekId)}{w.minStart ? ` (${w.minStart.slice(0, 10)})` : ""}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isCompleted && (
                  <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">✓ Reassignment completed. Source week_ids have been updated.</p>
                )}
              </div>
            )}

            {/* Empty unscheduled state */}
            {uploadResult && uploadResult.unscheduledCount === 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50/40 p-4 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/10 dark:text-green-400">
                ✓ All sources in the merged list were found in the scheduling result. No reassignment needed.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
