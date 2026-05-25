"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanSession = {
  id: number;
  weekId: string;
  status: string;
  operatorName: string | null;
  excludedCycle2Ids: number[];
  excludedGfIds: number[];
  mergedCsvText: string | null;
  uploadedObsPlanText: string | null;
  unscheduledEpDbIds: string[];
  createdAt: string;
  updatedAt: string;
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
  exposureTimeUnit: string | null;
  sourcePriority: string | null;
  startTime: string | null;
  endTime: string | null;
  sourceType: "cycle2" | "gf";
  isExcluded: boolean;
};

type SourceStats = {
  count: number;
  totalCount: number;
  totalExposureS: number;
};

type UnscheduledSource = {
  rowId: number;
  table: "cycle2" | "gf";
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

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ["Select Week", "Cycle2 Sources", "GF Sources", "Overview"];

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
}: {
  rows: SourceRow[];
  excludedIds: Set<number>;
  onSelectionChange: (newExcluded: Set<number>) => void;
  stats: SourceStats | null;
  loading: boolean;
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
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">PI</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Priority</th>
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
                  <td className="px-3 py-2">{row.pi ?? "—"}</td>
                  <td className="px-3 py-2">{row.obsType ?? "—"}</td>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function WizardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<number>(0);
  const [session, setSession] = useState<PlanSession | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Step 2 & 3 data
  const [cycle2Rows, setCycle2Rows] = useState<SourceRow[]>([]);
  const [cycle2Stats, setCycle2Stats] = useState<SourceStats | null>(null);
  const [cycle2Loading, setCycle2Loading] = useState(false);
  const [excludedCycle2, setExcludedCycle2] = useState<Set<number>>(new Set());

  const [gfRows, setGfRows] = useState<SourceRow[]>([]);
  const [gfStats, setGfStats] = useState<SourceStats | null>(null);
  const [gfLoading, setGfLoading] = useState(false);
  const [excludedGf, setExcludedGf] = useState<Set<number>>(new Set());

  // Post-confirm
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [reassigning, setReassigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState<WeekOption[]>([]);

  // Nav saving state
  const [saving, setSaving] = useState(false);

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
      setExcludedCycle2(new Set(s.excludedCycle2Ids));
      setExcludedGf(new Set(s.excludedGfIds));

      // Restore step from status
      if (s.status === "uploaded" || s.status === "completed") setCurrentStep(3);
      else if (s.status === "confirmed") setCurrentStep(3);
      else setCurrentStep(0);

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

  // ── Load sources on step change ──────────────────────────────────────────

  useEffect(() => {
    if ((currentStep === 1 || currentStep === 3) && session && cycle2Rows.length === 0) {
      setCycle2Loading(true);
      fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=cycle2`)
        .then((r) => r.json())
        .then((d: { rows: SourceRow[]; stats: SourceStats }) => {
          setCycle2Rows(d.rows ?? []);
          setCycle2Stats(d.stats);
          setExcludedCycle2(new Set(session.excludedCycle2Ids));
        })
        .catch(console.error)
        .finally(() => setCycle2Loading(false));
    }
  }, [currentStep, session, cycle2Rows.length]);

  useEffect(() => {
    if ((currentStep === 2 || currentStep === 3) && session && gfRows.length === 0) {
      setGfLoading(true);
      fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=gf`)
        .then((r) => r.json())
        .then((d: { rows: SourceRow[]; stats: SourceStats }) => {
          setGfRows(d.rows ?? []);
          setGfStats(d.stats);
          setExcludedGf(new Set(session.excludedGfIds));
        })
        .catch(console.error)
        .finally(() => setGfLoading(false));
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

  // ── Load unscheduled if session was already uploaded ──────────────────────

  useEffect(() => {
    if (!session) return;
    if (session.status !== "uploaded" && session.status !== "completed") return;
    if (uploadResult) return;
    if (!session.unscheduledEpDbIds.length && !session.uploadedObsPlanText) return;

    // Reconstruct unscheduled list from cycle2 rows only (GF not tracked)
    const loadUnscheduled = async () => {
      const [c2Res, gfRes] = await Promise.all([
        fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=cycle2`),
        fetch(`/api/short-term-plan/sessions/${session.id}/sources?type=gf`),
      ]);
      const c2Data = (await c2Res.json()) as { rows: SourceRow[] };
      const gfData = (await gfRes.json()) as { rows: SourceRow[] };
      const unscheduledSet = new Set(session.unscheduledEpDbIds);
      const unscheduled: UnscheduledSource[] = [
        ...c2Data.rows.filter((r) => !r.isExcluded && r.epDbObjectId && unscheduledSet.has(r.epDbObjectId))
          .map((r) => ({ rowId: r.id, table: "cycle2" as const, sourceId: r.sourceId, epDbObjectId: r.epDbObjectId, sourceName: r.sourceName, obsType: r.obsType })),
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
        // Just save operator name if changed
        setCurrentStep(1);
      } else if (currentStep === 1) {
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludedCycle2Ids: [...excludedCycle2] }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(2);
      } else if (currentStep === 2) {
        const res = await fetch(`/api/short-term-plan/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ excludedGfIds: [...excludedGf] }),
        });
        if (!res.ok) { alert("Failed to save. Please try again."); return; }
        setCurrentStep(3);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!session) return;
    setSaving(true);
    try {
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

  // Allow re-editing step 2 or 3 from overview
  function goBackToStep(step: number) {
    setCurrentStep(step);
    // Force reload of source data
    if (step === 1) setCycle2Rows([]);
    if (step === 2) setGfRows([]);
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

  // Merged stats for step 4
  const cycle2Included = cycle2Rows.filter((r) => !excludedCycle2.has(r.id));
  const gfIncluded = gfRows.filter((r) => !excludedGf.has(r.id));
  const mergedAll = [...cycle2Included, ...gfIncluded];

  function calcExpS(rows: SourceRow[]) {
    return rows.reduce((sum, r) => {
      const v = parseFloat(r.totalExposureTimeAll ?? r.totalExposureTime ?? "0");
      const unit = r.exposureTimeUnit?.toLowerCase() ?? "";
      return sum + (unit === "ks" ? v * 1000 : unit === "hr" ? v * 3600 : v);
    }, 0);
  }
  const cycle2ExpS = calcExpS(cycle2Included);
  const gfExpS = calcExpS(gfIncluded);
  const mergedExpS = cycle2ExpS + gfExpS;

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
                This session will load sources from <strong>Cycle2 Long-Term</strong> and <strong>Cycle2-GF</strong> tables for week <strong>{formatWeekId(session.weekId)}</strong>. Click Next to proceed.
              </p>
            </div>
          )}

          {/* Step 2: Cycle2 sources */}
          {currentStep === 1 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Step 2: Cycle2 Long-Term Sources</h2>
                <span className="text-xs text-slate-500">Week: {formatWeekId(session.weekId)}</span>
              </div>
              <SourceTable
                rows={cycle2Rows}
                excludedIds={excludedCycle2}
                onSelectionChange={setExcludedCycle2}
                stats={cycle2Stats}
                loading={cycle2Loading}
              />
            </div>
          )}

          {/* Step 3: GF sources */}
          {currentStep === 2 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Step 3: Cycle2-GF Sources</h2>
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

          {/* Step 4: Overview */}
          {currentStep === 3 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Step 4: Overview & Confirm</h2>

              {/* Stats summary */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Total Sources", value: mergedAll.length },
                  { label: "Cycle2 Sources", value: cycle2Included.length },
                  { label: "GF Sources", value: gfIncluded.length },
                  { label: "Cycle2 Exposure", value: fmtKs(cycle2ExpS) },
                  { label: "GF Exposure", value: fmtKs(gfExpS) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Modify selections links */}
              <div className="mb-4 flex gap-3">
                <button onClick={() => goBackToStep(1)} className="text-xs text-primary underline-offset-2 hover:underline">
                  ✏ Modify Cycle2 selection
                </button>
                <button onClick={() => goBackToStep(2)} className="text-xs text-primary underline-offset-2 hover:underline">
                  ✏ Modify GF selection
                </button>
              </div>

              {/* Merged table preview (first 20 rows) */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-3 py-2">Cycle</th>
                      <th className="px-3 py-2">Source ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">PI</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2 text-right">Exp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mergedAll.slice(0, 50).map((row) => (
                      <tr key={`${row.sourceType}-${row.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            row.sourceType === "gf"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-primary/10 text-primary"
                          }`}>{row.sourceType === "gf" ? "GF" : "C2"}</span>
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
                        <td className="px-3 py-1.5 text-right">{row.totalExposureTimeAll ?? row.totalExposureTime ?? "—"} {row.exposureTimeUnit ?? ""}</td>
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
          {currentStep < 3 && (
            <button
              onClick={() => void saveAndNext()}
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Next →"}
            </button>
          )}
        </div>

        {/* ── Post-confirm section ─────────────────────────────────────────────── */}
        {isConfirmed && currentStep === 3 && (
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

                {/* Run Scheduler (placeholder) */}
                <div className="relative group">
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-400 dark:border-slate-700"
                  >
                    ▶ Run Scheduler
                  </button>
                  <span className="invisible group-hover:visible absolute bottom-full left-0 mb-1.5 rounded-md bg-slate-800 px-2 py-1 text-xs text-white whitespace-nowrap">Coming soon</span>
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
