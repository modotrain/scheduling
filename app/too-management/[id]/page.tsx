"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ApprovedTooRow = {
  id: number;
  flux03To10KeV: string | null;
  completeness: string | null;
  continuousExposure: string | null;
  epscProposal: boolean | null;
  epDbObjectId: string | null;
  fxtCmr: string | null;
  fxtX: string | null;
  fxtY: string | null;
  payload: string | null;
  receivedTime: string | null;
  requestNumberOfVisits: number | null;
  requestRestrainedBeginTime: string | null;
  requestRestrainedEndTime: string | null;
  requestSingleExposureTime: number | null;
  requestTotalExposureTime: number | null;
  requestUrgencyOfObservation: string | null;
  requestCadence: number | null;
  requestCadenceUnit: string | null;
  reviewedNumberOfVisits: string | null;
  reviewedScientificImportance: string | null;
  reviewedSingleExposureTime: string | null;
  reviewedTotalExposureTime: string | null;
  reviewedUrgencyOfObservation: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  reviewedTime: string | null;
  stp: string | null;
  sourceType: string | null;
  vBandMagnitude: string | null;
  wxtCmos: string | null;
  wxtCmosX: string | null;
  wxtCmosY: string | null;
  dec: string | null;
  exposureTimeUnit: string | null;
  fxt1Filter: string | null;
  fxt1WindowMode: string | null;
  fxt2Filter: string | null;
  fxt2WindowMode: string | null;
  groupName: string | null;
  pi: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  ra: string | null;
  sourceId: string | null;
  sourceName: string | null;
  type: string | null;
};

type InputStringKeys = Exclude<
  keyof ApprovedTooRow,
  "id" | "epscProposal" | "requestNumberOfVisits" | "requestSingleExposureTime" | "requestTotalExposureTime" | "requestCadence"
>;

type InputRow = { [K in InputStringKeys]: string } & {
  epscProposal: "" | "true" | "false";
  requestNumberOfVisits: string;
  requestSingleExposureTime: string;
  requestTotalExposureTime: string;
  requestCadence: string;
};

type FieldChange = {
  key: keyof InputRow;
  label: string;
  before: string;
  after: string;
};

const FIELDS: Array<{ key: keyof InputRow; label: string; type?: "text" | "number" | "select" }> = [
  { key: "sourceName", label: "Source Name" },
  { key: "sourceId", label: "Source ID" },
  { key: "proposalNo", label: "Proposal No" },
  { key: "proposalId", label: "Proposal ID" },
  { key: "pi", label: "PI" },
  { key: "groupName", label: "Group" },
  { key: "type", label: "Type" },
  { key: "sourceType", label: "Source Type" },
  { key: "stp", label: "STP" },
  { key: "epscProposal", label: "EPSC Proposal", type: "select" },
  { key: "epDbObjectId", label: "EP DB Object ID" },
  { key: "payload", label: "Payload" },
  { key: "flux03To10KeV", label: "0.3-10 keV Flux" },
  { key: "vBandMagnitude", label: "V-band Magnitude" },
  { key: "ra", label: "RA" },
  { key: "dec", label: "Dec" },
  { key: "continuousExposure", label: "Continuous Exposure" },
  { key: "exposureTimeUnit", label: "Exposure Time Unit" },
  { key: "requestUrgencyOfObservation", label: "Request Urgency" },
  { key: "requestSingleExposureTime", label: "Request Single Exp. Time", type: "number" },
  { key: "requestTotalExposureTime", label: "Request Total Exp. Time", type: "number" },
  { key: "requestNumberOfVisits", label: "Request Number of Visits", type: "number" },
  { key: "requestCadence", label: "Request Cadence", type: "number" },
  { key: "requestCadenceUnit", label: "Request Cadence Unit" },
  { key: "requestRestrainedBeginTime", label: "Request Restrained Begin Time" },
  { key: "requestRestrainedEndTime", label: "Request Restrained End Time" },
  { key: "receivedTime", label: "Received Time" },
  { key: "reviewedScientificImportance", label: "Reviewed Scientific Importance" },
  { key: "reviewedUrgencyOfObservation", label: "Reviewed Urgency" },
  { key: "reviewedSingleExposureTime", label: "Reviewed Single Exp. Time" },
  { key: "reviewedTotalExposureTime", label: "Reviewed Total Exp. Time" },
  { key: "reviewedNumberOfVisits", label: "Reviewed Number of Visits" },
  { key: "reviewedCadence", label: "Reviewed Cadence" },
  { key: "reviewedCadenceUnit", label: "Reviewed Cadence Unit" },
  { key: "reviewedTime", label: "Reviewed Time" },
  { key: "completeness", label: "Completeness" },
  { key: "fxtCmr", label: "FXT CMR" },
  { key: "fxtX", label: "FXT X" },
  { key: "fxtY", label: "FXT Y" },
  { key: "fxt1WindowMode", label: "FXT1 Window Mode" },
  { key: "fxt1Filter", label: "FXT1 Filter" },
  { key: "fxt2WindowMode", label: "FXT2 Window Mode" },
  { key: "fxt2Filter", label: "FXT2 Filter" },
  { key: "wxtCmos", label: "WXT CMOS" },
  { key: "wxtCmosX", label: "WXT CMOS X" },
  { key: "wxtCmosY", label: "WXT CMOS Y" },
];

const SECTIONS: Array<{ title: string; fields: Array<keyof InputRow> }> = [
  {
    title: "Identification",
    fields: ["sourceName", "sourceId", "proposalNo", "proposalId", "pi", "groupName", "type", "sourceType", "stp", "epscProposal", "epDbObjectId", "payload"],
  },
  {
    title: "Position & Flux",
    fields: ["ra", "dec", "flux03To10KeV", "vBandMagnitude"],
  },
  {
    title: "Request",
    fields: ["requestUrgencyOfObservation", "requestSingleExposureTime", "requestTotalExposureTime", "requestNumberOfVisits", "requestCadence", "requestCadenceUnit", "continuousExposure", "exposureTimeUnit", "requestRestrainedBeginTime", "requestRestrainedEndTime", "receivedTime"],
  },
  {
    title: "Review",
    fields: ["reviewedScientificImportance", "reviewedUrgencyOfObservation", "reviewedSingleExposureTime", "reviewedTotalExposureTime", "reviewedNumberOfVisits", "reviewedCadence", "reviewedCadenceUnit", "reviewedTime", "completeness"],
  },
  {
    title: "Instrument",
    fields: ["fxtCmr", "fxtX", "fxtY", "fxt1WindowMode", "fxt1Filter", "fxt2WindowMode", "fxt2Filter", "wxtCmos", "wxtCmosX", "wxtCmosY"],
  },
];

const FIELD_LABEL: Partial<Record<keyof InputRow, string>> = Object.fromEntries(
  FIELDS.map(({ key, label }) => [key, label]),
) as Partial<Record<keyof InputRow, string>>;

const numberFields = new Set<keyof InputRow>([
  "requestNumberOfVisits",
  "requestSingleExposureTime",
  "requestTotalExposureTime",
  "requestCadence",
]);

function rowToInput(row: ApprovedTooRow): InputRow {
  return {
    flux03To10KeV: row.flux03To10KeV ?? "",
    completeness: row.completeness ?? "",
    continuousExposure: row.continuousExposure ?? "",
    epscProposal: row.epscProposal === null ? "" : row.epscProposal ? "true" : "false",
    epDbObjectId: row.epDbObjectId ?? "",
    fxtCmr: row.fxtCmr ?? "",
    fxtX: row.fxtX ?? "",
    fxtY: row.fxtY ?? "",
    payload: row.payload ?? "",
    receivedTime: row.receivedTime ?? "",
    requestNumberOfVisits: row.requestNumberOfVisits === null ? "" : String(row.requestNumberOfVisits),
    requestRestrainedBeginTime: row.requestRestrainedBeginTime ?? "",
    requestRestrainedEndTime: row.requestRestrainedEndTime ?? "",
    requestSingleExposureTime: row.requestSingleExposureTime === null ? "" : String(row.requestSingleExposureTime),
    requestTotalExposureTime: row.requestTotalExposureTime === null ? "" : String(row.requestTotalExposureTime),
    requestUrgencyOfObservation: row.requestUrgencyOfObservation ?? "",
    requestCadence: row.requestCadence === null ? "" : String(row.requestCadence),
    requestCadenceUnit: row.requestCadenceUnit ?? "",
    reviewedNumberOfVisits: row.reviewedNumberOfVisits ?? "",
    reviewedScientificImportance: row.reviewedScientificImportance ?? "",
    reviewedSingleExposureTime: row.reviewedSingleExposureTime ?? "",
    reviewedTotalExposureTime: row.reviewedTotalExposureTime ?? "",
    reviewedUrgencyOfObservation: row.reviewedUrgencyOfObservation ?? "",
    reviewedCadence: row.reviewedCadence ?? "",
    reviewedCadenceUnit: row.reviewedCadenceUnit ?? "",
    reviewedTime: row.reviewedTime ?? "",
    stp: row.stp ?? "",
    sourceType: row.sourceType ?? "",
    vBandMagnitude: row.vBandMagnitude ?? "",
    wxtCmos: row.wxtCmos ?? "",
    wxtCmosX: row.wxtCmosX ?? "",
    wxtCmosY: row.wxtCmosY ?? "",
    dec: row.dec ?? "",
    exposureTimeUnit: row.exposureTimeUnit ?? "",
    fxt1Filter: row.fxt1Filter ?? "",
    fxt1WindowMode: row.fxt1WindowMode ?? "",
    fxt2Filter: row.fxt2Filter ?? "",
    fxt2WindowMode: row.fxt2WindowMode ?? "",
    groupName: row.groupName ?? "",
    pi: row.pi ?? "",
    proposalId: row.proposalId ?? "",
    proposalNo: row.proposalNo ?? "",
    ra: row.ra ?? "",
    sourceId: row.sourceId ?? "",
    sourceName: row.sourceName ?? "",
    type: row.type ?? "",
  };
}

function formatFieldValue(key: keyof InputRow, value: string): string {
  if (key === "epscProposal") {
    return value === "true" ? "Yes" : value === "false" ? "No" : "—";
  }
  return value || "—";
}

function getChangedFields(original: InputRow, next: InputRow): FieldChange[] {
  return FIELDS.flatMap(({ key, label }) => {
    const before = original[key] ?? "";
    const after = next[key] ?? "";
    if (before === after) {
      return [];
    }
    return [
      {
        key,
        label,
        before: formatFieldValue(key, before),
        after: formatFieldValue(key, after),
      },
    ];
  });
}

export default function TooManagementDetailPage() {
  const pathname = usePathname();
  const id = pathname?.split("/").at(-1) ?? "";

  const [row, setRow] = useState<ApprovedTooRow | null>(null);
  const [input, setInput] = useState<InputRow>({} as InputRow);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<FieldChange[]>([]);

  function setStatus(nextMessage: string, tone: "success" | "error") {
    setMessage(nextMessage);
    setMessageTone(tone);
  }

  const loadRow = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/approved-too/${id}`, { cache: "no-store" });
      const data = (await response.json()) as { row?: ApprovedTooRow; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load");
      }
      if (data.row) {
        setRow(data.row);
        setInput(rowToInput(data.row));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRow();
  }, [loadRow]);

  async function commitSave() {
    setSaving(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(input).map(([key, value]) => {
          if (key === "epscProposal") {
            if (value === "") return [key, null];
            return [key, value === "true"];
          }

          if (numberFields.has(key as keyof InputRow)) {
            if (value === "") return [key, null];
            return [key, Number(value)];
          }

          return [key, value === "" ? null : value];
        }),
      );

      const response = await fetch(`/api/approved-too/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { row?: ApprovedTooRow; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save");
      }

      if (data.row) {
        setRow(data.row);
        setInput(rowToInput(data.row));
      }

      setEditing(false);
      setStatus("Saved successfully", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row || saving) {
      return;
    }

    const original = rowToInput(row);
    const changes = getChangedFields(original, input);
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
    if (row) {
      setInput(rowToInput(row));
    }
    setEditing(false);
    setConfirmOpen(false);
    setPendingChanges([]);
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">ToO Management — {row?.sourceName ?? `Record #${id}`}</h1>
            {row?.pi ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{row.pi}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/too-management"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to list
            </Link>
          </div>
        </div>

        {message ? (
          <p className={`mt-3 text-sm ${messageTone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {message}
          </p>
        ) : null}

        <section className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="flex items-center justify-between rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="text-base font-semibold">Request Information</h2>
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
                  form="too-detail-form"
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={loading || !row}
                onClick={() => setEditing(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Edit
              </button>
            )}
          </div>

          {loading ? (
            <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : !row ? (
            <p className="px-4 py-4 text-sm text-rose-600">Record not found.</p>
          ) : (
            <form id="too-detail-form" onSubmit={handleSave}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {SECTIONS.map((section) => (
                  <div key={section.title} className="px-5 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {section.title}
                    </p>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {section.fields.map((key) => {
                        const fieldMeta = FIELDS.find((f) => f.key === key);
                        const fieldType = fieldMeta?.type;
                        const rawVal = input[key] ?? "";

                        if (editing) {
                          return (
                            <div key={key}>
                              <dt className="mb-1 text-xs text-slate-500 dark:text-slate-400">{FIELD_LABEL[key]}</dt>
                              <dd>
                                {fieldType === "select" ? (
                                  <select
                                    disabled={saving}
                                    value={rawVal}
                                    onChange={(event) =>
                                      setInput((prev) => ({
                                        ...prev,
                                        [key]: event.target.value as InputRow[typeof key],
                                      }))
                                    }
                                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                  >
                                    <option value="">—</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                ) : (
                                  <input
                                    type={fieldType === "number" ? "number" : "text"}
                                    disabled={saving}
                                    value={String(rawVal)}
                                    onChange={(event) =>
                                      setInput((prev) => ({
                                        ...prev,
                                        [key]: event.target.value as InputRow[typeof key],
                                      }))
                                    }
                                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                  />
                                )}
                              </dd>
                            </div>
                          );
                        }

                        const displayVal = formatFieldValue(key, rawVal);
                        return (
                          <div key={key}>
                            <dt className="text-xs text-slate-500 dark:text-slate-400">{FIELD_LABEL[key]}</dt>
                            <dd className={`mt-0.5 break-words text-sm font-medium ${displayVal === "—" ? "text-slate-300 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"}`}>
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
          )}
        </section>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirm Save Changes</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Please review the modified fields before saving.
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
                      <div className={`col-span-4 break-words ${change.before === "—" ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>
                        {change.before}
                      </div>
                      <div className={`col-span-4 break-words ${change.after === "—" ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
                        {change.after}
                      </div>
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
  );
}
