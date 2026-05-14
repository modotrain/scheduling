"use client";

import { SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  concluded: boolean;
};

type InputStringKeys = Exclude<
  keyof ApprovedTooRow,
  "id" | "epscProposal" | "requestNumberOfVisits" | "requestSingleExposureTime" | "requestTotalExposureTime" | "requestCadence" | "concluded"
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

type ChangeLogEntry = {
  id: number;
  approvedTooId: number;
  operatorName: string | null;
  changedAt: string;
  changes: Array<{ key: string; label: string; before: string; after: string }>;
  snapshotBefore: Record<string, string>;
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
  scheduledStatus: "scheduled" | "queued";
  matchedObsWpId: number | null;
  matchedObsWpCount?: number;
  matchedObsWpIds?: number[] | string[] | string;
};

function normalizeObsWpIds(value: PlanningRow["matchedObsWpIds"]): number[] {
  if (!value) return [];
  if (typeof value === "string") {
    const cleaned = value.replace(/[{}]/g, "");
    return cleaned
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  }
  return [];
}

type TooManagementCachePayload = {
  ts: number;
  rows: Array<{ id: number; sourceName: string | null }>;
};

const TOO_MANAGEMENT_CACHE_KEY = "too-management-list-cache-v1";

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

type GpPoolRow = {
  scheduledStatus: "scheduled" | "queued";
  plannedStartTime: string | null;
  reviewedSingleExposureTimeSnapshot: number | null;
  reviewedNumberOfVisitsSnapshot: number | null;
};

function getWeekKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr.split(" ")[0]!;
  const d = new Date(`${normalized}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000);
  const weekNo = Math.round((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
  return `${d.getUTCFullYear()}-W${String(Math.max(1, weekNo)).padStart(2, "0")}`;
}

function normalizeCadenceUnit(unit: string | null | undefined): "day" | "orbit" | "" {
  const u = unit?.trim().toLowerCase();
  if (u === "day" || u === "days") return "day";
  if (u === "orbit" || u === "orbits") return "orbit";
  return "";
}

function getISOWeekLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00Z`);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000);
  const weekNo = Math.round((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
  return `W${String(Math.max(1, weekNo)).padStart(2, "0")}`;
}

function getTuesdayWindowForDateStringFE(dateString: string): { start: string; end: string } {
  const d = new Date(`${dateString}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesday = new Date(d.getTime() - daysSinceTuesday * 86_400_000);
  const start = [tuesday.getUTCFullYear(), String(tuesday.getUTCMonth() + 1).padStart(2, "0"), String(tuesday.getUTCDate()).padStart(2, "0")].join("-");
  return { start, end: addDaysToDateString(start, 7) };
}

function addFractionalDaysFE(dateString: string, days: number): string {
  const ms = new Date(`${dateString}T00:00:00Z`).getTime() + days * 86_400_000;
  const d = new Date(ms);
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0")].join("-");
}

function computeAllVisitWindowsFE(
  firstStart: string,
  firstEnd: string,
  numberOfVisits: number,
  cadenceVal: number,
  cadenceUnit: string,
): Array<{ start: string; end: string; weekStart: string }> {
  const cadenceDays =
    cadenceVal > 0
      ? cadenceUnit === "orbit"
        ? (cadenceVal * 97 * 60) / 86_400
        : cadenceVal
      : 0;
  const safeEnd = firstEnd || addDaysToDateString(firstStart, 7);
  const rangeDays =
    (new Date(`${safeEnd}T00:00:00Z`).getTime() - new Date(`${firstStart}T00:00:00Z`).getTime()) /
    86_400_000;

  // Step 1: how many visits fit in the first week
  let numberInFirstWeek: number;
  if (cadenceDays <= 0 || cadenceDays >= 7) {
    numberInFirstWeek = 1;
  } else {
    numberInFirstWeek = Math.max(1, Math.ceil((rangeDays - 1) / cadenceDays));
  }

  // Step 2: narrow the actual first range
  const actualStart = firstStart;
  let actualEnd = addFractionalDaysFE(safeEnd, -(cadenceDays * (numberInFirstWeek - 1)));
  if (
    new Date(`${actualEnd}T00:00:00Z`).getTime() - new Date(`${actualStart}T00:00:00Z`).getTime() <
    86_400_000
  ) {
    actualEnd = addDaysToDateString(actualStart, 1);
  }

  // Step 3: anchor point at 1/3 of actual range
  const actualDurationDays =
    (new Date(`${actualEnd}T00:00:00Z`).getTime() -
      new Date(`${actualStart}T00:00:00Z`).getTime()) /
    86_400_000;
  const time1 = addFractionalDaysFE(actualStart, Math.floor(actualDurationDays / 3));

  // Step 4: per-visit window = intersection(week window, cadence-shifted actual range)
  return Array.from({ length: numberOfVisits }, (_, n) => {
    const timeN = addFractionalDaysFE(time1, cadenceDays * n);
    const weekWindow = getTuesdayWindowForDateStringFE(timeN);
    const shiftedStart = addFractionalDaysFE(actualStart, cadenceDays * n);
    const shiftedEnd = addFractionalDaysFE(actualEnd, cadenceDays * n);

    const intStart = shiftedStart > weekWindow.start ? shiftedStart : weekWindow.start;
    const intEnd = shiftedEnd < weekWindow.end ? shiftedEnd : weekWindow.end;
    const weekStart = weekWindow.start;
    if (intStart < intEnd) {
      return { start: intStart, end: intEnd, weekStart };
    }
    return { start: shiftedStart, end: shiftedEnd, weekStart };
  });
}

// Returns the ISO week label (Wxx) anchored to the Tuesday-start week that
// contains the date, avoiding Monday-boundary mismatches.
function getWeekLabelFromDate(dateString: string | null): string {
  if (!dateString) return "—";
  const tuesdayStart = getTuesdayWindowForDateStringFE(dateString).start;
  return getISOWeekLabel(tuesdayStart);
}

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
      label: `${getISOWeekLabel(start)} · ${formatDateDisplay(start)} – ${formatDateDisplay(end)}`,
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
  const [userRole, setUserRole] = useState<'viewer' | 'operator' | 'admin'>('viewer');
  const [cachedSourceName, setCachedSourceName] = useState<string | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogLoading, setChangeLogLoading] = useState(true);
  const [changeLogExpanded, setChangeLogExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
  const [planningCadenceValue, setPlanningCadenceValue] = useState("0");
  const [planningCadenceUnit, setPlanningCadenceUnit] = useState("");
  const [planningSingleExposureTime, setPlanningSingleExposureTime] = useState("");
  const [planningNumberOfVisits, setPlanningNumberOfVisits] = useState("1");
  const [planningNotes, setPlanningNotes] = useState("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [gpPoolRows, setGpPoolRows] = useState<GpPoolRow[]>([]);
  const [gpPoolLoading, setGpPoolLoading] = useState(false);
  const [gpPlanView, setGpPlanView] = useState<'card' | 'list'>('card');
  const pageLoading = loading || planningLoading || scheduleLoading;
  const canEdit = userRole === 'operator' || userRole === 'admin';
  const canRestore = userRole === 'admin';
  const canManageGP = (userRole === 'operator' || userRole === 'admin') && !row?.concluded;
  const plannedWeekCount = new Set(
    planningRows.map((r) => r.generatedEpDbObjectId),
  ).size;
  const plannedVisitCount = planningRows.reduce(
    (sum, item) => sum + (item.reviewedNumberOfVisitsSnapshot ?? 1),
    0,
  );

  // Group individual-visit rows by generatedEpDbObjectId to display one card per week.
  const weekPlanningGroups = useMemo(() => {
    const map = new Map<string, PlanningRow[]>();
    for (const r of planningRows) {
      const key = r.generatedEpDbObjectId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.values()).map((rows) => {
      const first = rows[0]!;
      const earliestStart = rows
        .map((r) => r.plannedStartTime)
        .filter(Boolean)
        .sort()[0] ?? null;
      const latestEnd = rows
        .map((r) => r.plannedEndTime)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const scheduledCount = rows.filter((r) => r.scheduledStatus === "scheduled").length;
      // Merge all matched obs IDs across the week group
      const allMatchedIds = rows.flatMap((r) => {
        const ids = normalizeObsWpIds(r.matchedObsWpIds);
        return ids.length > 0 ? ids : r.matchedObsWpId ? [r.matchedObsWpId] : [];
      });
      const uniqueMatchedIds = [...new Set(allMatchedIds)];
      return {
        generatedEpDbObjectId: first.generatedEpDbObjectId,
        weekLabel: getWeekLabelFromDate(earliestStart),
        earliestStart,
        latestEnd,
        visitCount: rows.length,
        scheduledCount,
        cadenceValue: first.cadenceValue,
        cadenceUnit: first.cadenceUnit,
        singleExp: first.reviewedSingleExposureTimeSnapshot,
        notes: first.notes,
        operatorName: first.operatorName,
        rows,
        firstMatchedId: uniqueMatchedIds[0] ?? null,
        matchedIdsForQuery: uniqueMatchedIds,
      };
    });
  }, [planningRows]);

  const matchedWindowPreset = useMemo(() => {
    return planningWindowOptions.find(
      (option) => option.start === plannedStartInput && option.end === plannedEndInput,
    );
  }, [plannedEndInput, plannedStartInput, planningWindowOptions]);

  const cadenceNumeric = planningCadenceValue === "" ? null : Number(planningCadenceValue);
  const singleExposureNumeric = planningSingleExposureTime === "" ? null : Number(planningSingleExposureTime);
  const planningNumberOfVisitsNumeric =
    planningNumberOfVisits === "" ? null : Math.round(Number(planningNumberOfVisits));
  const computedTotalExposureTime =
    singleExposureNumeric !== null &&
    planningNumberOfVisitsNumeric !== null &&
    planningNumberOfVisitsNumeric > 0
      ? singleExposureNumeric * planningNumberOfVisitsNumeric
      : null;

  const planningValidationErrors = useMemo(() => {
    const errors: string[] = [];

    // Date range checks
    const earliestWeekStart = planningWindowOptions[0]?.start ?? null;
    if (plannedStartInput && earliestWeekStart && plannedStartInput < earliestWeekStart) {
      errors.push(`Start date must be on or after the earliest schedulable week (${formatDateDisplay(earliestWeekStart)}).`);
    }
    if (plannedStartInput && plannedEndInput && plannedEndInput <= plannedStartInput) {
      errors.push("End date must be after start date.");
    }

    if (plannedStartInput && plannedEndInput && plannedEndInput > plannedStartInput) {
      const isInSingleWeek = planningWindowOptions.some(
        (opt) => opt.start <= plannedStartInput && plannedEndInput <= opt.end,
      );
      if (!isInSingleWeek) {
        errors.push("Date range must be fully contained within a single week window (Tue–Tue).");
      }
    }

    if (cadenceNumeric !== null) {
      if (Number.isNaN(cadenceNumeric) || cadenceNumeric < 0) {
        errors.push("Cadence must be greater than or equal to 0.");
      }
      if (cadenceNumeric > 0 && !planningCadenceUnit) {
        errors.push("Cadence Unit is required when Cadence is greater than 0.");
      }
    }

    if (singleExposureNumeric !== null) {
      if (Number.isNaN(singleExposureNumeric) || singleExposureNumeric < 1000) {
        errors.push("Single Exposure Time must be at least 1000.");
      }
    }

    const reviewedN = Number(row?.reviewedNumberOfVisits ?? "0");
    if (planningNumberOfVisitsNumeric === null || planningNumberOfVisitsNumeric < 1) {
      errors.push("Number of GP Visits must be at least 1.");
    } else if (reviewedN > 0 && planningNumberOfVisitsNumeric > reviewedN) {
      errors.push(`Number of GP Visits cannot exceed reviewed visits (${reviewedN}).`);
    }

    return errors;
  }, [planningWindowOptions, plannedStartInput, plannedEndInput, cadenceNumeric, planningCadenceUnit, singleExposureNumeric, planningNumberOfVisitsNumeric, row]);

  const visitPreviews = useMemo(() => {
    if (
      !editingPlanningId &&
      planningNumberOfVisitsNumeric !== null &&
      planningNumberOfVisitsNumeric > 0 &&
      plannedStartInput
    ) {
      const count = Math.min(planningNumberOfVisitsNumeric, 52);
      const windows = computeAllVisitWindowsFE(
        plannedStartInput,
        plannedEndInput,
        count,
        cadenceNumeric ?? 0,
        planningCadenceUnit,
      );
      return windows.map((w, i) => ({
        visitNo: i + 1,
        start: w.start,
        end: w.end,
        weekId: getISOWeekLabel(w.weekStart),
      }));
    }
    return [];
  }, [editingPlanningId, planningNumberOfVisitsNumeric, plannedStartInput, plannedEndInput, cadenceNumeric, planningCadenceUnit]);

  const modalWeeklyExposure = useMemo(() => {
    // Always produce exactly 6 buckets matching the dropdown week options
    const buckets = planningWindowOptions.map((opt) => {
      const weekKey = getWeekKey(opt.start) ?? opt.start;
      return { weekKey, label: weekKey.split("-")[1] ?? opt.start, ks: 0 };
    });
    const bucketIndex = new Map(buckets.map((b, i) => [b.weekKey, i]));
    for (const gpRow of gpPoolRows) {
      if (gpRow.scheduledStatus !== "queued") continue;
      if (!gpRow.plannedStartTime) continue;
      const weekKey = getWeekKey(gpRow.plannedStartTime);
      if (!weekKey) continue;
      const idx = bucketIndex.get(weekKey);
      if (idx === undefined) continue;
      const ks =
        ((gpRow.reviewedSingleExposureTimeSnapshot ?? 0) *
          (gpRow.reviewedNumberOfVisitsSnapshot ?? 0)) /
        1000;
      buckets[idx]!.ks += ks;
    }
    return buckets;
  }, [gpPoolRows, planningWindowOptions]);

  const modalChartMaxKs = 80;

  // Map weekKey → preview ks to overlay on the pool-load chart
  const previewKsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (editingPlanningId || !visitPreviews.length || !planningSingleExposureTime) return map;
    const expKs = Number(planningSingleExposureTime) / 1000;
    if (expKs <= 0) return map;
    for (const vp of visitPreviews) {
      const bucket = modalWeeklyExposure.find((b) => b.label === vp.weekId);
      if (bucket) map.set(bucket.weekKey, (map.get(bucket.weekKey) ?? 0) + expKs);
    }
    return map;
  }, [editingPlanningId, visitPreviews, planningSingleExposureTime, modalWeeklyExposure]);

  const canSubmitPlanning =
    !planningSubmitting &&
    !loading &&
    !!row &&
    !!row.epDbObjectId &&
    !!plannedStartInput &&
    planningValidationErrors.length === 0;

  const resetPlanningForm = useCallback(() => {
    const fallback = planningWindowOptions[0];
    setPlanningModalOpen(false);
    setEditingPlanningId(null);
    setPlanningWindowPreset(fallback?.value ?? "custom");
    setPlannedStartInput(fallback?.start ?? "");
    setPlannedEndInput(fallback?.end ?? "");
    setPlanningCadenceValue("0");
    setPlanningCadenceUnit("");
    setPlanningSingleExposureTime(row?.reviewedSingleExposureTime ?? "");
    setPlanningNumberOfVisits("1");
    setPlanningNotes("");
  }, [planningWindowOptions, row?.reviewedSingleExposureTime]);

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

  useEffect(() => {
    try {
      const rawCache = sessionStorage.getItem(TOO_MANAGEMENT_CACHE_KEY);
      if (!rawCache) {
        setCachedSourceName(null);
        return;
      }

      const parsed = JSON.parse(rawCache) as TooManagementCachePayload;
      const hit = parsed.rows?.find((item) => String(item.id) === id);
      setCachedSourceName(hit?.sourceName ?? null);
    } catch {
      setCachedSourceName(null);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { vip?: boolean; role?: string; username?: string | null };
        if (!cancelled) {
          setUserRole((data.role as 'viewer' | 'operator' | 'admin') ?? (data.vip ? 'admin' : 'viewer'));
        }
      } catch {
        if (!cancelled) {
          setUserRole('viewer');
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadChangeLog = useCallback(async () => {
    setChangeLogLoading(true);
    try {
      const response = await fetch(`/api/approved-too/${id}/change-log`, { cache: "no-store" });
      const data = (await response.json()) as { rows?: ChangeLogEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load change log");
      setChangeLog(data.rows ?? []);
    } catch {
      setChangeLog([]);
    } finally {
      setChangeLogLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadChangeLog();
  }, [loadChangeLog]);

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

  useEffect(() => {
    if (!planningModalOpen) return;
    const controller = new AbortController();
    setGpPoolLoading(true);
    void fetch("/api/tootogp-schedule", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ rows?: GpPoolRow[] }>) : Promise.reject()))
      .then((data: { rows?: GpPoolRow[] }) => { setGpPoolRows(data.rows ?? []); })
      .catch(() => { setGpPoolRows([]); })
      .finally(() => { setGpPoolLoading(false); });
    return () => { controller.abort(); };
  }, [planningModalOpen]);

  async function commitSave() {
    setSaving(true);

    try {
      if (!row) throw new Error("No row loaded");
      const original = rowToInput(row);
      const changes = getChangedFields(original, input);
      const snapshotBefore: Record<string, string> = Object.fromEntries(
        Object.entries(original).map(([k, v]) => [k, v ?? ""]),
      );

      const patch = Object.fromEntries(
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
        body: JSON.stringify({ patch, changes, snapshotBefore }),
      });

      const data = (await response.json()) as { row?: ApprovedTooRow; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save");
      }

      if (data.row) {
        setRow(data.row);
        setInput(rowToInput(data.row));
        setCachedSourceName(data.row.sourceName ?? null);
      }

      await loadPlanning();
      await loadSchedule();
      await loadChangeLog();
      sessionStorage.removeItem(TOO_MANAGEMENT_CACHE_KEY);
      setEditing(false);
      setStatus("Saved successfully", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreOriginal() {
    if (changeLog.length === 0) return;
    const original = changeLog[0].snapshotBefore;
    if (!window.confirm("Restore proposal information to the original version? This will also clear all change history.")) return;

    setRestoring(true);
    try {
      const patch = Object.fromEntries(
        Object.entries(original).map(([key, value]) => {
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

      const putRes = await fetch(`/api/approved-too/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Restore sends empty changes so no new log entry is created
        body: JSON.stringify({ patch, changes: [], snapshotBefore: original }),
      });
      if (!putRes.ok) throw new Error("Failed to restore");
      const putData = (await putRes.json()) as { row?: ApprovedTooRow };
      if (putData.row) {
        setRow(putData.row);
        setInput(rowToInput(putData.row));
        setCachedSourceName(putData.row.sourceName ?? null);
      }

      // Clear all change logs
      await fetch(`/api/approved-too/${id}/change-log`, { method: "DELETE" });
      setChangeLog([]);
      sessionStorage.removeItem(TOO_MANAGEMENT_CACHE_KEY);
      setStatus("Restored to original version", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to restore", "error");
    } finally {
      setRestoring(false);
    }
  }

  function handleSave(event: SubmitEvent<HTMLFormElement>) {
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
    if (planningValidationErrors.length > 0) {
      setStatus("Please resolve GP plan validation issues before saving", "error");
      return;
    }

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
          numberOfGpVisits: planningNumberOfVisitsNumeric ?? 1,
          notes: planningNotes || null,
        }),
        },
      );

      const data = (await response.json()) as { rows?: unknown[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Failed to ${editingPlanningId ? "update" : "create"} GP planning record`);
      }

      await loadPlanning();
      sessionStorage.removeItem(TOO_MANAGEMENT_CACHE_KEY);
      resetPlanningForm();
      setStatus(`${data.rows?.length ?? 1} GP planning record(s) ${editingPlanningId ? "updated" : "created"}`, "success");
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
    setPlanningNumberOfVisits("1");
    setPlanningNotes(item.notes ?? "");
  }

  function handleOpenCreatePlanning() {
    const fallback = planningWindowOptions[0];
    const reviewedVisitsStr = row?.reviewedNumberOfVisits ?? "1";
    const reviewedVisitsN = Number(reviewedVisitsStr);
    const isSingleVisit = !reviewedVisitsStr || reviewedVisitsN <= 1;
    setPlanningModalOpen(true);
    setEditingPlanningId(null);
    setPlanningWindowPreset(fallback?.value ?? "custom");
    setPlannedStartInput(fallback?.start ?? "");
    setPlannedEndInput(fallback?.end ?? "");
    setPlanningCadenceValue(isSingleVisit ? "0" : (row?.reviewedCadence ?? "0"));
    setPlanningCadenceUnit(isSingleVisit ? "" : normalizeCadenceUnit(row?.reviewedCadenceUnit));
    setPlanningSingleExposureTime(row?.reviewedSingleExposureTime ?? "");
    setPlanningNumberOfVisits(reviewedVisitsStr || "1");
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
      sessionStorage.removeItem(TOO_MANAGEMENT_CACHE_KEY);
      setStatus("GP planning record deleted", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete GP planning record", "error");
    } finally {
      setPlanningSubmitting(false);
    }
  }

  async function handleDeleteWeekGroup(groupRows: PlanningRow[]) {
    if (groupRows.length === 0) return;
    const label = groupRows[0]?.generatedEpDbObjectId ?? "";
    const msg =
      groupRows.length === 1
        ? `Delete planning record ${label}?`
        : `Delete all ${groupRows.length} visits for ${label}?`;
    if (!window.confirm(msg)) return;

    setPlanningSubmitting(true);
    try {
      const ids = groupRows.map((r) => r.id);
      if (ids.some((rid) => rid === editingPlanningId)) resetPlanningForm();
      for (const rid of ids) {
        const res = await fetch(`/api/tootogp-schedule/${rid}`, { method: "DELETE" });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? "Failed to delete GP planning record");
        }
      }
      await loadPlanning();
      sessionStorage.removeItem(TOO_MANAGEMENT_CACHE_KEY);
      setStatus(`${ids.length} GP planning record(s) deleted`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete GP planning records", "error");
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

  const headerSourceName = row?.sourceName ?? cachedSourceName;
  const headerTitle = headerSourceName ?? (loading ? "Loading…" : `Record #${id}`);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,rgba(101,170,221,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,93,151,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#e8f0f9_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(101,170,221,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(0,93,151,0.2),transparent_34%),linear-gradient(180deg,#020617_0%,#061426_100%)] dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-screen-xl rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">ToO Management — {headerTitle}</h1>
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
            <div className="flex items-center rounded-full border border-slate-300 bg-slate-200/70 p-1 text-xs shadow-inner dark:border-slate-600 dark:bg-slate-700/60">
              <button
                type="button"
                onClick={() => setGpPlanView('card')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition-all duration-150 ${
                  gpPlanView === 'card'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Card view"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="6" height="6" rx="1.2" />
                  <rect x="9" y="1" width="6" height="6" rx="1.2" />
                  <rect x="1" y="9" width="6" height="6" rx="1.2" />
                  <rect x="9" y="9" width="6" height="6" rx="1.2" />
                </svg>
                Cards
              </button>
              <button
                type="button"
                onClick={() => setGpPlanView('list')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition-all duration-150 ${
                  gpPlanView === 'list'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="List view"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="2" width="14" height="2.2" rx="1.1" />
                  <rect x="1" y="6.9" width="14" height="2.2" rx="1.1" />
                  <rect x="1" y="11.8" width="14" height="2.2" rx="1.1" />
                </svg>
                List
              </button>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Planned <span className="font-mono font-medium">{plannedVisitCount}</span> visit{plannedVisitCount === 1 ? "" : "s"} in <span className="font-mono font-medium">{plannedWeekCount}</span> week{plannedWeekCount === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/tootogp-schedule"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                GP Pool
              </Link>
              <button
                type="button"
                onClick={handleOpenCreatePlanning}
                disabled={planningSubmitting || loading || !row || !row.epDbObjectId || !canManageGP}
                title={!canManageGP && row?.concluded ? "GP operations are frozen: this record is concluded" : !canManageGP ? "Permission denied: operator or admin only" : ""}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Add GP Visit
              </button>
            </div>
          </div>

          {row?.concluded ? (
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="inline-flex rounded-md bg-slate-300/60 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-600/60 dark:text-slate-300">Concluded</span>
                GP plan operations are frozen.
              </span>
              {userRole === 'admin' ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/approved-too/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ concluded: false }),
                      });
                      if (res.ok) {
                        const data = (await res.json()) as { row?: ApprovedTooRow };
                        if (data.row) setRow(data.row);
                      }
                    } catch { /* ignore */ }
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Unconclude
                </button>
              ) : null}
            </div>
          ) : null}

          {planningLoading ? (
            <div className="px-4 py-4" aria-hidden="true" />
          ) : planningRows.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
              No GP planning for this target. Add a GP visit to start tracking GP-Scheduled ToO proposal.
            </div>
          ) : gpPlanView === 'card' ? (
            <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-700 md:grid-cols-2 xl:grid-cols-3">
              {(() => {
                const todayStr = new Date().toISOString().split("T")[0]!;
                const currentTuesdayStart = getTuesdayWindowForDateStringFE(todayStr).start;
                const nextWeekLabel = getISOWeekLabel(addDaysToDateString(currentTuesdayStart, 7));
                return weekPlanningGroups.map((group) => {
                const allScheduled = group.scheduledCount === group.visitCount;
                const anyScheduled = group.scheduledCount > 0;
                const isQueued = !allScheduled;
                const isNextWeek = isQueued && group.weekLabel === nextWeekLabel;
                const statusLabel = allScheduled ? "Scheduled" : anyScheduled ? "Partial" : "Queued";
                const statusClass = allScheduled
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : anyScheduled
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-primary/10 text-primary";
                const cardClass = allScheduled
                  ? "border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/70 dark:bg-emerald-950/20"
                  : isNextWeek
                    ? "border border-amber-200 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/25"
                    : "border border-dashed border-sky-200 bg-sky-50/50 dark:border-sky-800/60 dark:bg-sky-950/15";

                return (
                  <div key={group.generatedEpDbObjectId} className={`rounded-xl p-4 shadow-sm ${cardClass}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className={`mb-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </div>
                        <h3 className="line-clamp-2 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {group.generatedEpDbObjectId}
                        </h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {isNextWeek ? (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                            Next Week
                          </span>
                        ) : null}
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {group.visitCount} visit{group.visitCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                          {group.weekLabel}
                        </span>
                      </div>
                    </div>

                    {/* Summary window + cadence */}
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Window Start</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{formatDateDisplay(group.earliestStart)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Window End</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{formatDateDisplay(group.latestEnd)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Cadence</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">
                          {group.cadenceValue ? `${group.cadenceValue} ${group.cadenceUnit || ""}`.trim() : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Single Exp. Time</dt>
                        <dd className="mt-0.5 break-words text-slate-900 dark:text-slate-100">{group.singleExp ?? "—"}</dd>
                      </div>
                    </dl>

                    {/* Notes */}
                    {group.notes ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        {group.notes}
                      </p>
                    ) : null}

                    {/* Footer */}
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                      <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">Operator:</span>{" "}
                        <span className="break-words text-slate-700 dark:text-slate-200">{group.operatorName || "—"}</span>
                      </p>
                      <div className="flex flex-wrap justify-end gap-2">
                        {/* Single-visit card: show Edit button */}
                        {group.visitCount === 1 && !allScheduled && canManageGP ? (
                          <button
                            type="button"
                            onClick={() => handleEditPlanning(group.rows[0]!)}
                            disabled={planningSubmitting}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                        ) : null}
                        {/* Delete week group (all non-scheduled rows) */}
                        {isQueued && canManageGP ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteWeekGroup(group.rows.filter((r) => r.scheduledStatus !== "scheduled"))}
                            disabled={planningSubmitting}
                            className="rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                          >
                            {group.visitCount === 1 ? "Delete" : `Delete (${group.rows.filter((r) => r.scheduledStatus !== "scheduled").length})`}
                          </button>
                        ) : null}
                        {/* Observation Details */}
                        {group.firstMatchedId ? (
                          <Link
                            href={`/obs-wp/${group.firstMatchedId}?matched=${group.matchedIdsForQuery.join(",")}`}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Observation Details ({group.matchedIdsForQuery.length})
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          ) : (
            <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="w-10 px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Generated ID</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Week</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Window</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Cadence</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Exp (s)</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {planningRows.map((item) => {
                    const scheduled = item.scheduledStatus === "scheduled";
                    const normalizedIds = normalizeObsWpIds(item.matchedObsWpIds);
                    const firstMatchedId = item.matchedObsWpId ?? normalizedIds[0] ?? null;
                    const matchedIdsForQuery = normalizedIds.length > 0 ? normalizedIds : item.matchedObsWpId ? [item.matchedObsWpId] : [];
                    return (
                      <tr
                        key={item.id}
                        className={`text-sm ${scheduled ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "hover:bg-slate-50/40 dark:hover:bg-slate-800/30"}`}
                      >
                        <td className="px-3 py-2 font-mono text-xs text-slate-400 dark:text-slate-500">{item.sequenceNo}</td>
                        <td className="max-w-[14rem] px-3 py-2">
                          <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-200">{item.generatedEpDbObjectId}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            {getWeekLabelFromDate(item.plannedStartTime)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {formatDateDisplay(item.plannedStartTime)} → {formatDateDisplay(item.plannedEndTime)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {item.cadenceValue ? `${item.cadenceValue} ${item.cadenceUnit || ""}`.trim() : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {item.reviewedSingleExposureTimeSnapshot ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${scheduled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"}`}>
                            {scheduled ? "Scheduled" : "Queued"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {!scheduled && canManageGP ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditPlanning(item)}
                                  disabled={planningSubmitting}
                                  className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeletePlanning(item)}
                                  disabled={planningSubmitting}
                                  className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                            {firstMatchedId ? (
                              <Link
                                href={`/obs-wp/${firstMatchedId}?matched=${matchedIdsForQuery.join(",")}`}
                                className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Obs
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
            <h2 className="text-base font-semibold">Proposal Information</h2>
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
              <span title={canEdit ? "" : "Permission denied: operator or admin only"}>
                <button
                  type="button"
                  disabled={loading || !row || !canEdit}
                  onClick={() => setEditing(true)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit
                </button>
              </span>
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

          {/* ── Change History ── */}
          {!changeLogLoading && changeLog.length > 0 ? (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setChangeLogExpanded((v) => !v)}
                className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  Change History
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {changeLog.length}
                  </span>
                </span>
                <span className="text-slate-400">{changeLogExpanded ? "▲" : "▼"}</span>
              </button>

              {changeLogExpanded ? (
                <div className="px-4 pb-4 pt-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Original version snapshot is preserved. You can restore it at any time.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleRestoreOriginal()}
                      disabled={restoring || !canRestore}
                      title={canRestore ? "" : "Permission denied: admin only"}
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
                    >
                      {restoring ? "Restoring…" : "↩ Restore original version"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {changeLog.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                              #{changeLog.length - idx}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {new Date(entry.changedAt).toLocaleString("en-CA", {
                                year: "numeric", month: "2-digit", day: "2-digit",
                                hour: "2-digit", minute: "2-digit", timeZone: "UTC",
                              })}{" "}
                              UTC
                            </span>
                          </div>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {entry.operatorName ?? "unknown"}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {entry.changes.map((c) => (
                            <div key={c.key} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs">
                              <div className="col-span-3 font-medium text-slate-600 dark:text-slate-300">{c.label}</div>
                              <div className="col-span-4 break-words text-slate-400 line-through dark:text-slate-500">{c.before}</div>
                              <div className="col-span-5 break-words font-medium text-slate-800 dark:text-slate-100">{c.after}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
                {editingPlanningId ? "Edit GP Plan" : "Add GP Plan"}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Define the schedulable date window and planning GP visits for this source.
              </p>
            </div>

            <div className="max-h-[70vh] overflow-auto px-6 py-4">
              {/* ── First Visit Range + Pool Load ── */}
              <div className="mt-4 flex items-stretch gap-4">
                <div className="min-w-0 flex-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  First Visit Range
                </p>

                {/* Row 1: Full Week quick-fill */}
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Quick-fill by full week
                    {matchedWindowPreset ? (
                      <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        matched
                      </span>
                    ) : null}
                  </label>
                  <select
                    value={planningWindowPreset}
                    onChange={(event) => handlePlanningPresetChange(event.target.value)}
                    disabled={planningSubmitting || loading || !row}
                    className={`w-full rounded-md border px-3 py-2 text-sm dark:text-slate-100 ${
                      matchedWindowPreset
                        ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-900/25"
                        : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    {planningWindowOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="custom">Manual range (edit dates below)</option>
                  </select>
                </div>

                {/* Row 2: Start / End date pickers + duration badge */}
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Start Date</label>
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
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      End Date{" "}
                      <span className="font-normal text-slate-400 dark:text-slate-500">(exclusive)</span>
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
                  {/* Duration badge */}
                  <div className="pb-[2px] text-right">
                    {(() => {
                      if (!plannedStartInput || !plannedEndInput) return null;
                      const ms =
                        new Date(`${plannedEndInput}T00:00:00Z`).getTime() -
                        new Date(`${plannedStartInput}T00:00:00Z`).getTime();
                      const days = Math.round(ms / 86_400_000);
                      if (days <= 0) return null;
                      return (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {days} day{days !== 1 ? "s" : ""}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Disambiguation note */}
                <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                  The window opens at 00:00 on the start date and closes at 00:00 on the end date
                  (end-exclusive). For example, May 5 – May 6 means May 5 00:00 to May 6 00:00 (UTC).
                </p>
                </div>

                {/* Pool load chart */}
                <div className="flex h-56 w-[19.5rem] shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="mb-2 shrink-0">
                    <p className="text-[11px] font-semibold tracking-widest text-slate-400 dark:text-slate-500">Planned ToO in GP (ks)</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>Scale: 0–80 ks (40/50 guide)</span>
                      {previewKsMap.size > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1 py-0.5 text-primary dark:bg-primary/20">
                          <span className="inline-block h-1.5 w-3 rounded-sm bg-primary/70" />
                          preview
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {gpPoolLoading ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-slate-400 dark:text-slate-500">Loading…</div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="relative h-36 rounded-md border border-slate-200/80 bg-white/70 px-2 pb-1 pt-2 dark:border-slate-700 dark:bg-slate-900/45">
                        {[40, 50].map((guide) => (
                          <div
                            key={guide}
                            className="pointer-events-none absolute inset-x-2 border-t border-dashed border-slate-300/85 dark:border-slate-600/80"
                            style={{ bottom: `${(guide / modalChartMaxKs) * 100}%` }}
                          >
                            <span className="absolute -right-1 -top-2.5 translate-x-full text-[9px] font-medium text-slate-400 dark:text-slate-500">
                              {guide}
                            </span>
                          </div>
                        ))}
                        <div className="grid h-full grid-cols-6 items-end gap-2">
                          {modalWeeklyExposure.map(({ weekKey, ks }) => {
                            const previewKs = previewKsMap.get(weekKey) ?? 0;
                            const totalKs = ks + previewKs;
                            const clampedExisting = Math.min(Math.max(0, ks), modalChartMaxKs);
                            const clampedPreview = Math.min(Math.max(0, previewKs), modalChartMaxKs - clampedExisting);
                            const existingBarH = clampedExisting <= 0 ? 0 : Math.max(4, Math.round((clampedExisting / modalChartMaxKs) * 118));
                            const previewBarH = clampedPreview <= 0 ? 0 : Math.max(4, Math.round((clampedPreview / modalChartMaxKs) * 118));
                            const totalBarH = existingBarH + previewBarH || 4;
                            const existingToneClass =
                              ks >= 50
                                ? "bg-rose-700/70 dark:bg-rose-400/45"
                                : ks >= 40
                                  ? "bg-amber-700/68 dark:bg-amber-400/45"
                                  : ks > 0
                                    ? "bg-emerald-700/68 dark:bg-emerald-400/48"
                                    : "bg-slate-200/60 dark:bg-slate-700/40";
                            const previewToneClass =
                              totalKs >= 50
                                ? "bg-rose-500/55 dark:bg-rose-400/40"
                                : totalKs >= 40
                                  ? "bg-amber-500/55 dark:bg-amber-400/40"
                                  : "bg-primary/60 dark:bg-primary/45";
                            return (
                              <div key={weekKey} className="flex h-full min-w-0 flex-col items-center justify-end gap-0.5">
                                <span className={`text-[10px] font-medium tabular-nums ${previewKs > 0 ? "text-primary dark:text-sky-300" : "text-slate-600 dark:text-slate-300"}`}>
                                  {totalKs > 0 ? totalKs.toFixed(1) : "0"}
                                </span>
                                <div
                                  style={{ height: totalBarH }}
                                  className="flex w-8 flex-col overflow-hidden rounded-t shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                                >
                                  {previewBarH > 0 ? (
                                    <div
                                      style={{ height: previewBarH }}
                                      className={`w-full shrink-0 ${previewToneClass} border-b border-white/30 dark:border-white/10`}
                                    />
                                  ) : null}
                                  <div className={`w-full flex-1 ${existingToneClass}`} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-1 grid grid-cols-6 gap-2">
                        {modalWeeklyExposure.map(({ weekKey, label }) => (
                          <span key={weekKey} className="text-center font-mono text-[9px] text-slate-400 dark:text-slate-500">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Add mode: read-only params + prominent visit count ── */}
              {!editingPlanningId ? (
                <>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Reviewed Parameters
                    </p>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                      <div>
                        <span className="mr-1.5 text-xs text-slate-500 dark:text-slate-400">Cadence:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {planningCadenceValue && planningCadenceValue !== "0"
                            ? `${planningCadenceValue}${planningCadenceUnit ? ` ${planningCadenceUnit}` : ""}`
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="mr-1.5 text-xs text-slate-500 dark:text-slate-400">Single Exp. Time:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {planningSingleExposureTime ? `${Number(planningSingleExposureTime).toLocaleString()} s` : "—"}
                        </span>
                      </div>
                      {computedTotalExposureTime !== null ? (
                        <div>
                          <span className="mr-1.5 text-xs text-slate-500 dark:text-slate-400">Total Exp. Time:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {computedTotalExposureTime.toLocaleString()} s
                            {planningNumberOfVisitsNumeric && planningNumberOfVisitsNumeric > 1
                              ? ` (${planningSingleExposureTime} × ${planningNumberOfVisitsNumeric})`
                              : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid h-44 grid-cols-4 items-stretch gap-3">
                    {/* Left: Number of GP Visits */}
                    <div className="flex h-full flex-col justify-center rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-4 dark:border-primary/30 dark:bg-primary/10">
                      <label className="mb-1 block text-sm font-semibold text-primary dark:text-sky-300">
                        Number of GP Visits
                      </label>
                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                        Reviewed: <span className="font-semibold text-slate-700 dark:text-slate-200">{row?.reviewedNumberOfVisits ?? "—"}</span>
                      </p>
                      <input
                        type="number"
                        min={1}
                        max={Number(row?.reviewedNumberOfVisits ?? "999") || 999}
                        step={1}
                        value={planningNumberOfVisits}
                        onChange={(event) => setPlanningNumberOfVisits(event.target.value)}
                        disabled={planningSubmitting || loading || !row}
                        className="w-full rounded-lg border-2 border-primary/50 bg-white px-3 py-2.5 text-lg font-semibold text-primary shadow-sm focus:border-primary focus:outline-none dark:border-primary/40 dark:bg-slate-900 dark:text-sky-300"
                      />
                    </div>

                    {/* Right: Visit Preview */}
                    <div className="col-span-3 flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="shrink-0 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                        Visit Preview
                      </div>
                      {visitPreviews.length > 0 ? (
                        <div className="flex-1 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/60">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Visit</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Week</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Window Start</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Window End</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {visitPreviews.map((vp) => (
                                <tr key={vp.visitNo} className={vp.visitNo % 2 === 0 ? "bg-slate-50/50 dark:bg-slate-800/20" : ""}>
                                  <td className="px-3 py-1.5 font-mono">{vp.visitNo}</td>
                                  <td className="px-3 py-1.5 font-mono text-primary">{vp.weekId}</td>
                                  <td className="px-3 py-1.5">{formatDateDisplay(vp.start)}</td>
                                  <td className="px-3 py-1.5">{formatDateDisplay(vp.end)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center justify-center px-4 text-xs text-slate-400 dark:text-slate-500">
                          Enter visits above to see schedule preview
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* ── Edit mode: all fields editable ── */
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Cadence
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={planningCadenceValue}
                        min={0}
                        step={1}
                        placeholder="0"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (nextValue === "") {
                            setPlanningCadenceValue("");
                            setPlanningCadenceUnit("");
                            return;
                          }
                          const parsed = Number(nextValue);
                          if (!Number.isNaN(parsed) && parsed >= 0) {
                            setPlanningCadenceValue(nextValue);
                            if (parsed === 0) {
                              setPlanningCadenceUnit("");
                            }
                          }
                        }}
                        disabled={planningSubmitting || loading || !row}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      {cadenceNumeric === 0 ? (
                        <span className="pointer-events-none absolute inset-y-0 left-8 flex items-center text-xs text-slate-500 dark:text-slate-400">
                          (one-time visit)
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Cadence Unit
                    </label>
                    <select
                      value={planningCadenceUnit}
                      onChange={(event) => setPlanningCadenceUnit(event.target.value)}
                      disabled={planningSubmitting || loading || !row || cadenceNumeric === null || cadenceNumeric <= 0}
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
                      min={1000}
                      step={1000}
                      value={planningSingleExposureTime}
                      onChange={(event) => setPlanningSingleExposureTime(event.target.value)}
                      disabled={planningSubmitting || loading || !row}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div />
                </div>
              )}

              {editingPlanningId && computedTotalExposureTime !== null ? (
                <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  Total Exposure Time:{" "}
                  <span className="font-mono font-semibold">{computedTotalExposureTime.toLocaleString()} s</span>
                  {planningNumberOfVisitsNumeric && planningNumberOfVisitsNumeric > 1
                    ? ` (${planningSingleExposureTime} × ${planningNumberOfVisitsNumeric})`
                    : ""}
                </div>
              ) : null}

              <div
                className={`mt-4 h-10 rounded-lg border px-4 text-sm ${
                  planningValidationErrors.length > 0
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-200"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-200"
                }`}
              >
                <p
                  className="flex h-full items-center truncate"
                  title={
                    planningValidationErrors.length > 0
                      ? planningValidationErrors.join(" | ")
                      : "All planning constraints are satisfied and ready to save."
                  }
                >
                  {planningValidationErrors.length > 0
                    ? planningValidationErrors.join(" | ")
                    : "All planning constraints are satisfied and ready to save."}
                </p>
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
                disabled={!canSubmitPlanning}
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
