"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type ScheduleRow = {
  id: number;
  obs_id: string | null;
  ep_db_object_id: string | null;
  main_type: string | null;
  wp_type: string | null;
  wp_urgency: string | null;
  obs_type: string | null;
  source_name: string | null;
  start_date: string | null;
  end_date: string | null;
  pointing_duration_in_seconds: string | null;
  user_name: string | null;
};

type PlanningRow = {
  id: number;
  approvedTooId: number;
  operatorName: string | null;
  sourceName: string | null;
  parentEpDbObjectId: string;
  generatedEpDbObjectId: string;
  sequenceNo: number;
  earliestStartTime: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  cadenceValue: number | null;
  cadenceUnit: string | null;
  reviewedNumberOfVisitsSnapshot: number | null;
  reviewedSingleExposureTimeSnapshot: number | null;
  reviewedTotalExposureTimeSnapshot: number | null;
  status: string;
  notes: string | null;
  scheduledStatus: "scheduled" | "unscheduled";
  matchedObsWpId: number | null;
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
  { key: "epDbObjectId", label: "DB ID" },
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

type PlanningWindowOption = {
  value: string;
  label: string;
  start: string;
  end: string;
};

function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function formatDateDisplay(dateString: string | null): string {
  if (!dateString) {
    return "—";
  }

  const date = new Date(`${dateString}T00:00:00Z`);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function getUpcomingTuesdayWindows(count: number): PlanningWindowOption[] {
  const reference = new Date();
  reference.setUTCDate(reference.getUTCDate() + 3);

  const day = reference.getUTCDay();
  const daysUntilTuesday = (2 - day + 7) % 7;
  reference.setUTCDate(reference.getUTCDate() + daysUntilTuesday);

  return Array.from({ length: count }, (_value, index) => {
    const startDate = new Date(reference);
    startDate.setUTCDate(startDate.getUTCDate() + index * 7);

    const start = [startDate.getUTCFullYear(), String(startDate.getUTCMonth() + 1).padStart(2, "0"), String(startDate.getUTCDate()).padStart(2, "0")].join("-");
    const end = addDaysToDateString(start, 7);

    return {
      value: `${start}:${end}`,
      label: `${formatDateDisplay(start)} to ${formatDateDisplay(end)}`,
      start,
      end,
    };
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
  const [planningRows, setPlanningRows] = useState<PlanningRow[]>([]);
  const [planningLoading, setPlanningLoading] = useState(true);
  const [planningSubmitting, setPlanningSubmitting] = useState(false);
  const [planningModalOpen, setPlanningModalOpen] = useState(false);
  const [editingPlanningId, setEditingPlanningId] = useState<number | null>(null);
  const planningWindowOptions = useMemo(() => getUpcomingTuesdayWindows(6), []);
  const [planningWindowPreset, setPlanningWindowPreset] = useState(planningWindowOptions[0]?.value ?? "custom");
  const [plannedStartInput, setPlannedStartInput] = useState(planningWindowOptions[0]?.start ?? "");
  const [plannedEndInput, setPlannedEndInput] = useState(planningWindowOptions[0]?.end ?? "");
  const [planningCadenceValue, setPlanningCadenceValue] = useState("");
  const [planningCadenceUnit, setPlanningCadenceUnit] = useState("");
  const [planningSingleExposureTime, setPlanningSingleExposureTime] = useState("");
  const [planningTotalExposureTime, setPlanningTotalExposureTime] = useState("");
  const [planningNotes, setPlanningNotes] = useState("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const pageLoading = loading || planningLoading || scheduleLoading;

  const resetPlanningForm = useCallback(() => {
    const fallback = planningWindowOptions[0];
    setPlanningModalOpen(false);
    setEditingPlanningId(null);
    setPlanningWindowPreset(fallback?.value ?? "custom");
    setPlannedStartInput(fallback?.start ?? "");
    setPlannedEndInput(fallback?.end ?? "");
    setPlanningCadenceValue(row?.reviewedCadence ?? "");
    setPlanningCadenceUnit(row?.reviewedCadenceUnit ?? "");
    setPlanningSingleExposureTime(row?.reviewedSingleExposureTime ?? "");
    setPlanningTotalExposureTime(row?.reviewedTotalExposureTime ?? "");
    setPlanningNotes("");
  }, [planningWindowOptions, row?.reviewedCadence, row?.reviewedCadenceUnit, row?.reviewedSingleExposureTime, row?.reviewedTotalExposureTime]);

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

  const loadPlanning = useCallback(async () => {
    setPlanningLoading(true);
    try {
      const response = await fetch(`/api/approved-too/${id}/gp-planning`, { cache: "no-store" });
      const data = (await response.json()) as { rows?: PlanningRow[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load GP planning");
      }
      setPlanningRows(data.rows ?? []);
    } catch {
      setPlanningRows([]);
    } finally {
      setPlanningLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    resetPlanningForm();
  }, [resetPlanningForm]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const response = await fetch(`/api/approved-too/${id}/schedule`, { cache: "no-store" });
      const data = (await response.json()) as { rows?: ScheduleRow[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load schedule information");
      }
      setScheduleRows(data.rows ?? []);
    } catch {
      setScheduleRows([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

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

      await loadPlanning();
      await loadSchedule();
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

  async function handleSubmitPlanning() {
    setPlanningSubmitting(true);

    try {
      const response = await fetch(
        editingPlanningId ? `/api/tootogp-schedule/${editingPlanningId}` : `/api/approved-too/${id}/gp-planning`,
        {
          method: editingPlanningId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartTime: plannedStartInput || null,
          plannedEndTime: plannedEndInput || addDaysToDateString(plannedStartInput, 7),
          cadenceValue: planningCadenceValue ? Number(planningCadenceValue) : null,
          cadenceUnit: planningCadenceUnit || null,
          reviewedSingleExposureTimeSnapshot: planningSingleExposureTime ? Number(planningSingleExposureTime) : null,
          reviewedTotalExposureTimeSnapshot: planningTotalExposureTime ? Number(planningTotalExposureTime) : null,
          notes: planningNotes || null,
        }),
        },
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Failed to ${editingPlanningId ? "update" : "create"} GP planning record`);
      }

      await loadPlanning();
      resetPlanningForm();
      setStatus(`GP planning record ${editingPlanningId ? "updated" : "created"}`, "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : `Failed to ${editingPlanningId ? "update" : "create"} GP planning record`,
        "error",
      );
    } finally {
      setPlanningSubmitting(false);
    }
  }

  function handlePlanningPresetChange(nextValue: string) {
    setPlanningWindowPreset(nextValue);
    const selected = planningWindowOptions.find((option) => option.value === nextValue);
    if (selected) {
      setPlannedStartInput(selected.start);
      setPlannedEndInput(selected.end);
    }
  }

  function handleEditPlanning(item: PlanningRow) {
    setPlanningModalOpen(true);
    setEditingPlanningId(item.id);
    setPlanningWindowPreset("custom");
    setPlannedStartInput(item.plannedStartTime ?? "");
    setPlannedEndInput(item.plannedEndTime ?? "");
    setPlanningCadenceValue(item.cadenceValue === null ? "" : String(item.cadenceValue));
    setPlanningCadenceUnit(item.cadenceUnit ?? "");
    setPlanningSingleExposureTime(
      item.reviewedSingleExposureTimeSnapshot === null ? "" : String(item.reviewedSingleExposureTimeSnapshot),
    );
    setPlanningTotalExposureTime(
      item.reviewedTotalExposureTimeSnapshot === null ? "" : String(item.reviewedTotalExposureTimeSnapshot),
    );
    setPlanningNotes(item.notes ?? "");
  }

  function handleOpenCreatePlanning() {
    const fallback = planningWindowOptions[0];
    setPlanningModalOpen(true);
    setEditingPlanningId(null);
    setPlanningWindowPreset(fallback?.value ?? "custom");
    setPlannedStartInput(fallback?.start ?? "");
    setPlannedEndInput(fallback?.end ?? "");
    setPlanningCadenceValue(row?.reviewedCadence ?? "");
    setPlanningCadenceUnit(row?.reviewedCadenceUnit ?? "");
    setPlanningSingleExposureTime(row?.reviewedSingleExposureTime ?? "");
    setPlanningTotalExposureTime(row?.reviewedTotalExposureTime ?? "");
    setPlanningNotes("");
  }

  async function handleDeletePlanning(item: PlanningRow) {
    if (!window.confirm(`Delete planning record ${item.generatedEpDbObjectId}?`)) {
      return;
    }

    setPlanningSubmitting(true);
    try {
      const response = await fetch(`/api/tootogp-schedule/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete GP planning record");
      }

      if (editingPlanningId === item.id) {
        resetPlanningForm();
      }
      await loadPlanning();
      setStatus("GP planning record deleted", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete GP planning record", "error");
    } finally {
      setPlanningSubmitting(false);
    }
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

        {pageLoading ? (
          <div className="mt-4 px-4">
            <div className="flex justify-center">
              <div className="h-2 w-36 rounded-sm border border-slate-300/60 bg-[repeating-linear-gradient(-45deg,rgba(100,116,139,0.12)_0px,rgba(100,116,139,0.12)_8px,rgba(100,116,139,0.3)_8px,rgba(100,116,139,0.3)_16px)] bg-[length:200%_100%] animate-[stripe-flow_1.1s_linear_infinite] dark:border-slate-600/70 dark:bg-[repeating-linear-gradient(-45deg,rgba(148,163,184,0.12)_0px,rgba(148,163,184,0.12)_8px,rgba(148,163,184,0.3)_8px,rgba(148,163,184,0.3)_16px)]" />
            </div>
          </div>
        ) : null}

        <section className="mt-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="mr-auto text-base font-semibold">GP Planning</h2>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Planned visits: <span className="font-mono font-medium">{planningRows.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/tootogp-schedule"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                All GP Planning
              </Link>
              <button
                type="button"
                onClick={handleOpenCreatePlanning}
                disabled={planningSubmitting || loading || !row || !row.epDbObjectId}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Add GP Visit
              </button>
            </div>
          </div>

          {planningLoading ? (
            <div className="px-4 py-4" aria-hidden="true" />
          ) : planningRows.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
              No GP planning for this target. Add a GP visit to start tracking GP-Scheduled ToO proposal.
            </div>
          ) : (
            <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-700 md:grid-cols-2 xl:grid-cols-3">
              {planningRows.map((item) => {
                const scheduled = item.scheduledStatus === "scheduled";
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 ${scheduled ? "border border-slate-200 dark:border-slate-700" : "border border-dashed border-slate-300 dark:border-slate-600"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`mb-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${scheduled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
                          {scheduled ? "Scheduled" : "Planned"}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.generatedEpDbObjectId}
                        </h3>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Visit {item.sequenceNo}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Window Start</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{formatDateDisplay(item.plannedStartTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Window End</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{formatDateDisplay(item.plannedEndTime)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Cadence</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">
                          {item.cadenceValue ? `${item.cadenceValue} ${item.cadenceUnit || ""}`.trim() : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Single Exp. Time</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.reviewedSingleExposureTimeSnapshot ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Total Exp. Time</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.reviewedTotalExposureTimeSnapshot ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Reviewed Visits</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.reviewedNumberOfVisitsSnapshot ?? "—"}</dd>
                      </div>
                    </dl>

                    {item.notes ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        {item.notes}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                      <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">Operator:</span>{" "}
                        <span className="break-words text-slate-700 dark:text-slate-200">{item.operatorName || "—"}</span>
                      </p>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditPlanning(item)}
                          disabled={planningSubmitting}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePlanning(item)}
                          disabled={planningSubmitting}
                          className="rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        >
                          Delete
                        </button>
                        {item.matchedObsWpId ? (
                          <Link
                            href={`/obs-wp/${item.matchedObsWpId}`}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Observation Details
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <h2 className="mr-auto text-base font-semibold">Schedule Information</h2>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Matched observations: <span className="font-mono font-medium">{scheduleRows.length}</span>
            </span>
          </div>

          {scheduleLoading ? (
            <div className="px-4 py-4" aria-hidden="true" />
          ) : scheduleRows.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
              No matching workplan records found for this proposal target.
            </div>
          ) : (
            <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-700 md:grid-cols-2 xl:grid-cols-3">
              {scheduleRows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 inline-flex rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {item.main_type || "—"}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.obs_id || item.source_name || `Obs WP #${item.id}`}
                      </h3>
                    </div>
                    <Link
                      href={`/obs-wp/${item.id}`}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Details
                    </Link>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Obs Type</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.obs_type || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">WP Urgency</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.wp_urgency || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Start</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.start_date || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">End</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.end_date || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Duration (sec)</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.pointing_duration_in_seconds || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">WP Type</dt>
                      <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{item.wp_type || "—"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
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
            <div className="px-4 py-4" aria-hidden="true" />
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

      {planningModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingPlanningId ? "Edit GP Planning" : "Add GP Planning"}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Define the schedulable date window and planning parameters for this GP visit.
              </p>
            </div>

            <div className="max-h-[70vh] overflow-auto px-6 py-4">
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                Planned Start and Planned End are the schedulable date window. The default preset starts from the first Tuesday after three days from today and spans to the following Tuesday.
              </p>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr] lg:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Tuesday Window Preset
                  </label>
                  <select
                    value={planningWindowPreset}
                    onChange={(event) => handlePlanningPresetChange(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {planningWindowOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="custom">Custom dates</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Window Start
                  </label>
                  <input
                    type="date"
                    value={plannedStartInput}
                    onChange={(event) => {
                      setPlanningWindowPreset("custom");
                      setPlannedStartInput(event.target.value);
                    }}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Window End
                  </label>
                  <input
                    type="date"
                    value={plannedEndInput}
                    onChange={(event) => {
                      setPlanningWindowPreset("custom");
                      setPlannedEndInput(event.target.value);
                    }}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cadence
                  </label>
                  <input
                    type="number"
                    value={planningCadenceValue}
                    onChange={(event) => setPlanningCadenceValue(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cadence Unit
                  </label>
                  <select
                    value={planningCadenceUnit}
                    onChange={(event) => setPlanningCadenceUnit(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">—</option>
                    <option value="day">day</option>
                    <option value="orbit">orbit</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Single Exposure Time
                  </label>
                  <input
                    type="number"
                    value={planningSingleExposureTime}
                    onChange={(event) => setPlanningSingleExposureTime(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total Exposure Time
                  </label>
                  <input
                    type="number"
                    value={planningTotalExposureTime}
                    onChange={(event) => setPlanningTotalExposureTime(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Planning Notes
                </label>
                <input
                  type="text"
                  value={planningNotes}
                  onChange={(event) => setPlanningNotes(event.target.value)}
                  disabled={planningSubmitting || loading || !row}
                  placeholder="Optional operator note"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => resetPlanningForm()}
                disabled={planningSubmitting}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitPlanning()}
                disabled={planningSubmitting || loading || !row || !row.epDbObjectId || !plannedStartInput}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {planningSubmitting ? "Saving..." : editingPlanningId ? "Save GP Visit" : "Add GP Visit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
