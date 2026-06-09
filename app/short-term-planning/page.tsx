"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ACTIVE_CYCLE, getCycleLabel } from "@/app/lib/cycles";

type SessionSummary = {
  id: number;
  weekId: string;
  status: string;
  operatorName: string | null;
  createdAt: string;
  updatedAt: string;
};

type WeekOption = {
  weekId: string;
  minStart: string | null;
  maxEnd: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  uploaded: { label: "Uploaded", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatWeekRange(minStart: string | null, maxEnd: string | null): string {
  if (!minStart) return "";
  const start = minStart.slice(0, 10);
  const end = maxEnd ? maxEnd.slice(0, 10) : "?";
  return `${start} – ${end}`;
}

/** Normalize any week ID to "W42" display format (handles "42", "WK42", "W42"). */
function formatWeekId(weekId: string): string {
  const num = parseInt(weekId.replace(/\D/g, ""), 10);
  return isNaN(num) ? weekId : `W${String(num).padStart(2, "0")}`;
}

export default function ShortTermPlanningPage() {
  const router = useRouter();
  const cycleLabel = getCycleLabel(ACTIVE_CYCLE);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newWeekId, setNewWeekId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const meData = (await meRes.json()) as { user: { allowShortTermPlanning: boolean } | null };
      if (!meData.user) { router.push("/login"); return; }
      if (!meData.user.allowShortTermPlanning) { setAccessDenied(true); setLoading(false); return; }

      const [sessRes, weeksRes] = await Promise.all([
        fetch("/api/short-term-plan/sessions"),
        fetch("/api/short-term-plan/weeks"),
      ]);
      const sessData = (await sessRes.json()) as { sessions: SessionSummary[] };
      const weeksData = (await weeksRes.json()) as { weeks: WeekOption[] };
      setSessions(sessData.sessions ?? []);
      setWeeks(weeksData.weeks ?? []);
      if (weeksData.weeks?.length) setNewWeekId(weeksData.weeks[0].weekId);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function handleCreate() {
    if (!newWeekId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/short-term-plan/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId: newWeekId }),
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 403) { setAccessDenied(true); return; }
      const data = (await res.json()) as { session: { id: number } };
      router.push(`/short-term-planning/${data.session.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this planning session? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      await fetch(`/api/short-term-plan/sessions?id=${id}`, { method: "DELETE" });
      await loadData();
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 dark:from-slate-950 dark:to-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl">
        {accessDenied && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/40 dark:bg-red-900/10">
            <p className="text-base font-semibold text-red-700 dark:text-red-400">Access Denied</p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">You do not have permission to access Short-Term Planning. Contact an admin to grant you access via the Users page.</p>
            <Link href="/" className="mt-3 inline-block text-sm text-primary underline">← Back to Home</Link>
          </div>
        )}
        {!accessDenied && (
        <>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              ← Home
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{cycleLabel} Short-Term Planning</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage weekly source list preparation with short-term scheduling integration.
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:opacity-80"
          >
            + New Session
          </button>
        </div>

        {/* Sessions table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-slate-400">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-slate-400">
              <p>No planning sessions yet.</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-400"
              >
                Create your first session
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3 text-left">Week</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Operator</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((s) => {
                  const st = STATUS_LABELS[s.status] ?? { label: s.status, color: "bg-slate-100 text-slate-600" };
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{formatWeekId(s.weekId)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.operatorName ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(s.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/short-term-planning/${s.id}`}
                            className="rounded border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
                          >
                            {s.status === "completed" ? "View" : "Continue"}
                          </Link>
                          <button
                            onClick={() => void handleDelete(s.id)}
                            disabled={deleteId === s.id}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            {deleteId === s.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </>
      )}
      </div>

      {/* New Session Modal */}
      {!accessDenied && showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">New Planning Session</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Week
                </label>
                <select
                  value={newWeekId}
                  onChange={(e) => setNewWeekId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  {weeks.map((w) => (
                    <option key={w.weekId} value={w.weekId}>
                      {formatWeekId(w.weekId)}{w.minStart ? ` · ${formatWeekRange(w.minStart, w.maxEnd)}` : ""}
                    </option>
                  ))}
                  {weeks.length === 0 && <option value="">No upcoming weeks available</option>}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating || !newWeekId}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
