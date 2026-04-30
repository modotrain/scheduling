"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type TooReq = {
  id: number;
  request_filename: string | null;
  request_date: string | null;
  request_urgency: string | null;
  obs_type: string | null;
  ep_db_object_id: string | null;
  source_name: string | null;
  right_ascension: string | null;
  declination: string | null;
  requested_obs_duration_in_seconds: number;
  requested_obs_duration_in_orbits: number;
  user_name: string | null;
  user_group: string | null;
  cmr: string | null;
  x: string | null;
  y: string | null;
  process_switch_a: string | null;
  observation_mode_a: string | null;
  filter_a: string | null;
  process_switch_b: string | null;
  observation_mode_b: string | null;
  filter_b: string | null;
  obs_priority: string | null;
  time_constraints: string | null;
  source_id: number;
  proposal_id: number;
  proposal_no: number;
  to_gp: boolean;
};

type RowInput = Omit<TooReq, "id" | "to_gp">;

const initialInput: RowInput = {
  request_filename: "",
  request_date: "",
  request_urgency: "",
  obs_type: "",
  ep_db_object_id: "",
  source_name: "",
  right_ascension: "",
  declination: "",
  requested_obs_duration_in_seconds: 0,
  requested_obs_duration_in_orbits: 0,
  user_name: "",
  user_group: "",
  cmr: "",
  x: "",
  y: "",
  process_switch_a: "",
  observation_mode_a: "",
  filter_a: "",
  process_switch_b: "",
  observation_mode_b: "",
  filter_b: "",
  obs_priority: "",
  time_constraints: "",
  source_id: 0,
  proposal_id: 0,
  proposal_no: 0,
};

function rowToInput(row: TooReq): RowInput {
  return {
    request_filename: row.request_filename ?? "",
    request_date: row.request_date ?? "",
    request_urgency: row.request_urgency ?? "",
    obs_type: row.obs_type ?? "",
    ep_db_object_id: row.ep_db_object_id ?? "",
    source_name: row.source_name ?? "",
    right_ascension: row.right_ascension ?? "",
    declination: row.declination ?? "",
    requested_obs_duration_in_seconds: row.requested_obs_duration_in_seconds,
    requested_obs_duration_in_orbits: row.requested_obs_duration_in_orbits,
    user_name: row.user_name ?? "",
    user_group: row.user_group ?? "",
    cmr: row.cmr ?? "",
    x: row.x ?? "",
    y: row.y ?? "",
    process_switch_a: row.process_switch_a ?? "",
    observation_mode_a: row.observation_mode_a ?? "",
    filter_a: row.filter_a ?? "",
    process_switch_b: row.process_switch_b ?? "",
    observation_mode_b: row.observation_mode_b ?? "",
    filter_b: row.filter_b ?? "",
    obs_priority: row.obs_priority ?? "",
    time_constraints: row.time_constraints ?? "",
    source_id: row.source_id,
    proposal_id: row.proposal_id,
    proposal_no: row.proposal_no,
  };
}

type FieldDef = {
  key: keyof RowInput;
  label: string;
  type?: "number" | "text";
};

const FIELDS: FieldDef[] = [
  { key: "source_name", label: "Source" },
  { key: "request_date", label: "Date" },
  { key: "request_urgency", label: "Urgency" },
  { key: "obs_type", label: "Obs Type" },
  { key: "ep_db_object_id", label: "EP DB Object ID" },
  { key: "right_ascension", label: "RA" },
  { key: "declination", label: "Dec" },
  { key: "requested_obs_duration_in_seconds", label: "Dur (s)", type: "number" },
  { key: "requested_obs_duration_in_orbits", label: "Dur (o)", type: "number" },
  { key: "user_name", label: "User" },
  { key: "user_group", label: "Group" },
  { key: "cmr", label: "CMR" },
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "process_switch_a", label: "Switch A" },
  { key: "observation_mode_a", label: "Mode A" },
  { key: "filter_a", label: "Filter A" },
  { key: "process_switch_b", label: "Switch B" },
  { key: "observation_mode_b", label: "Mode B" },
  { key: "filter_b", label: "Filter B" },
  { key: "obs_priority", label: "Priority" },
  { key: "time_constraints", label: "Time Constraints" },
  { key: "request_filename", label: "Filename" },
  { key: "source_id", label: "Source ID", type: "number" },
  { key: "proposal_id", label: "Proposal ID", type: "number" },
  { key: "proposal_no", label: "Proposal No", type: "number" },
];

// Compact columns shown in table view (full list appears in the edit modal)
const TABLE_COLS: (keyof TooReq)[] = [
  "id",
  "source_name",
  "request_date",
  "obs_type",
  "requested_obs_duration_in_seconds",
//   "requested_obs_duration_in_orbits",
  "right_ascension",
  "declination",
  "user_name",
  "obs_priority",
];

type SortConfig = {
  col: keyof TooReq | null;
  dir: "asc" | "desc";
};

export default function TooReqPage() {
  const [rows, setRows] = useState<TooReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  // search & sort
  const [searchText, setSearchText] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ col: null, dir: "asc" });
  const [showOnlyToGp, setShowOnlyToGp] = useState(false);

  // edit modal
  const [editRow, setEditRow] = useState<TooReq | null>(null);
  const [editInput, setEditInput] = useState<RowInput>(initialInput);

  // delete confirmation
  const [deleteCandidate, setDeleteCandidate] = useState<TooReq | null>(null);

  function setStatus(msg: string, tone: "success" | "error") {
    setMessage(msg);
    setMessageTone(tone);
  }

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/too-req", { cache: "no-store" });
      const data = (await res.json()) as { rows?: TooReq[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRows(data.rows ?? []);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // ── to_gp toggle ──────────────────────────────────────────────────────────
  async function handleToggleto_gp(row: TooReq) {
    setSaving(true);
    try {
      const res = await fetch(`/api/too-req/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_gp: !row.to_gp }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStatus(row.to_gp ? "Removed to_gp flag" : "Marked as to_gp", "success");
      await loadRows();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to toggle", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── edit modal ─────────────────────────────────────────────────────────────
  function openEdit(row: TooReq) {
    setEditRow(row);
    setEditInput(rowToInput(row));
    setMessage("");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/too-req/${editRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editInput),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditRow(null);
      setStatus("Row updated", "success");
      await loadRows();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── delete confirmation ───────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteCandidate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/too-req/${deleteCandidate.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      setDeleteCandidate(null);
      setStatus("Row deleted", "success");
      await loadRows();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function colLabel(col: keyof TooReq) {
    if (col === "id") return "ID";
    const found = FIELDS.find((f) => f.key === (col as keyof RowInput));
    return found?.label ?? col;
  }

  function cellValue(row: TooReq, col: keyof TooReq) {
    const val = row[col];
    if (val === null || val === undefined || val === "") return <span className="text-slate-400">—</span>;
    return String(val);
  }

  function searchMatches(row: TooReq, query: string): boolean {
    if (!query.trim()) return true;
    const lowerQuery = query.toLowerCase();
    return Object.values(row).some((val) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(lowerQuery);
    });
  }

  function handleSort(col: keyof TooReq) {
    let newDir: "asc" | "desc" = "asc";
    if (sortConfig.col === col && sortConfig.dir === "asc") {
      newDir = "desc";
    }
    setSortConfig({ col, dir: newDir });
  }

  function getSortedAndFilteredRows() {
    const result = rows.filter((row) => {
      const matchesSearch = searchMatches(row, searchText);
      const matchesGpFilter = showOnlyToGp ? row.to_gp : true;
      return matchesSearch && matchesGpFilter;
    });

    if (sortConfig.col) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.col!];
        const bVal = b[sortConfig.col!];

        let aComp = aVal;
        let bComp = bVal;

        if (aComp == null) aComp = sortConfig.col === "id" ? -Infinity : "";
        if (bComp == null) bComp = sortConfig.col === "id" ? -Infinity : "";

        let cmp = 0;
        if (typeof aComp === "number" && typeof bComp === "number") {
          cmp = aComp - bComp;
        } else {
          cmp = String(aComp).localeCompare(String(bComp));
        }

        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }

  function SortIcon({ col }: { col: keyof TooReq }) {
    if (sortConfig.col !== col) return <span className="ml-1 text-slate-300">⇅</span>;
    return <span className="ml-1 text-primary">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">ToO Requests</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              View, edit, delete, and toggle GP flag on each observation request.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gp-cycle2"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              GP Cycle 2
            </Link>
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

        <div className="mt-6 space-y-3">
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={showOnlyToGp}
              onChange={(e) => setShowOnlyToGp(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
            />
            Show only rows with GP flag
          </label>
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
                    <span className="flex items-center justify-between">
                      {colLabel(col)}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2">GP</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 2}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 2}>
                    No rows yet.
                  </td>
                </tr>
              ) : getSortedAndFilteredRows().length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400" colSpan={TABLE_COLS.length + 2}>
                    {searchText ? "No matching rows." : "No rows yet."}
                  </td>
                </tr>
              ) : (
                getSortedAndFilteredRows().map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                    {TABLE_COLS.map((col) => (
                      <td key={col} className="whitespace-nowrap px-3 py-2">
                        {cellValue(row, col)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          row.to_gp ? "bg-brand-light/20 text-brand-dark dark:bg-brand-dark/30 dark:text-brand-light" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {row.to_gp ? "GP" : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => openEdit(row)}
                          className="rounded-md bg-amber-500 px-3 py-1 text-white disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleToggleto_gp(row)}
                          className={`rounded-md px-3 py-1 text-white disabled:opacity-60 ${
                            row.to_gp ? "bg-slate-700" : "bg-primary"
                          }`}
                        >
                          {row.to_gp ? "to Too" : "to GP"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setDeleteCandidate(row)}
                          className="rounded-md bg-rose-600 px-3 py-1 text-white disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {editRow ? (
        <div className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-950/35 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 className="text-lg font-semibold">Edit row #{editRow.id}</h2>
            <form onSubmit={handleUpdate} className="mt-4 grid gap-3 sm:grid-cols-2">
              {FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
                  <input
                    type={type ?? "text"}
                    value={editInput[key] ?? ""}
                    onChange={(e) =>
                      setEditInput((prev) => ({
                        ...prev,
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {deleteCandidate ? (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <h2 className="text-lg font-semibold">Delete row?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will remove row #{deleteCandidate.id}
              {deleteCandidate.source_name ? ` (${deleteCandidate.source_name})` : ""} from the
              table. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteCandidate(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDelete}
                className="rounded-md bg-rose-600 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
