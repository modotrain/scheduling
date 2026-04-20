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
  { key: "anticipatedToo", label: "Anticipated TOO" },
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

export default function GpCycle2DetailPage() {
  const pathname = usePathname();
  const id = pathname?.split("/").at(-1) ?? "";

  const [row, setRow] = useState<GpCycle2Row | null>(null);
  const [input, setInput] = useState<FieldInput>({} as FieldInput);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  function setStatus(msg: string, tone: "success" | "error") {
    setMessage(msg);
    setMessageTone(tone);
  }

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
  }, [loadRow]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      // convert "" back to null for nullable fields
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
      setStatus("Saved successfully", "success");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (row) setInput(rowToInput(row));
    setEditing(false);
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">GP Cycle 2 — Record #{id}</h1>
            {row?.sourceName ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.sourceName}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/gp-cycle2"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to list
            </Link>
            {!editing && !loading && row ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>

        {message ? (
          <p
            className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}
          >
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-slate-500 dark:text-slate-400">Loading…</p>
        ) : !row ? (
          <p className="mt-8 text-rose-600">Record not found.</p>
        ) : (
          <form onSubmit={handleSave} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* ID — always read-only */}
              <div className="sm:col-span-2">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  ID
                </span>
                <span className="mt-0.5 block text-sm font-mono">{row.id}</span>
              </div>

              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    {label}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={(input[key] as string) ?? ""}
                      onChange={(e) =>
                        setInput((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  ) : (
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {row[key] !== null && row[key] !== undefined && row[key] !== "" ? (
                        String(row[key])
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {editing ? (
              <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-emerald-700"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </main>
  );
}
