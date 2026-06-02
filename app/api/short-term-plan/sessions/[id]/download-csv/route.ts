import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACTIVE_CYCLE, getCycleEpoch } from "@/app/lib/cycles";
import { db } from "@/src/db/client";
import { getCycleTables } from "@/src/db/cycle-tables";
import {
  approvedToO,
  shortTermPlanSessions,
  tooToGpSchedule,
} from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

const FALLBACK_EPOCH = "2025-08-12";
function getWeekNumFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr.split(" ")[0]!;
  const d = new Date(`${normalized}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesdayMs = d.getTime() - daysSinceTuesday * 86_400_000;
  const epochMs = new Date(`${getCycleEpoch(ACTIVE_CYCLE) ?? FALLBACK_EPOCH}T00:00:00Z`).getTime();
  return Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
}

type SourceRow = {
  id: number;
  sourceId: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  epDbObjectId: string | null;
  pi: string | null;
  groupName: string | null;
  sourceName: string | null;
  obsType: string | null;
  ra: string | null;
  dec: string | null;
  totalExposureTime: string | null;
  totalExposureTimeAll: string | null;
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
  payload: string | null;
  wxtCmos: string | null;
  wxtCmosX: string | null;
  wxtCmosY: string | null;
  fxtCmr: string | null;
  fxtX: string | null;
  fxtY: string | null;
  isForDisrupted: string | null;
};

type TooGpRawRow = {
  id: number;
  sourceId: string | null;
  sourceName: string | null;
  sourceType: string | null;
  pi: string | null;
  groupName: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  ra: string | null;
  dec: string | null;
  completeness: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  fxt1WindowMode: string | null;
  fxt1Filter: string | null;
  fxt2WindowMode: string | null;
  fxt2Filter: string | null;
  wxtCmos: string | null;
  wxtCmosX: string | null;
  wxtCmosY: string | null;
  fxtCmr: string | null;
  fxtX: string | null;
  fxtY: string | null;
  generatedEpDbObjectId: string;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  reviewedSingleExposureTimeSnapshot: number | null;
  reviewedTotalExposureTimeSnapshot: number | null;
  reviewedNumberOfVisitsSnapshot: number | null;
  scheduledStatus: "scheduled" | "queued";
};

type TooGpGroupedRow = {
  sourceId: string | null;
  sourceName: string | null;
  sourceType: string | null;
  pi: string | null;
  groupName: string | null;
  proposalId: string | null;
  proposalNo: string | null;
  ra: string | null;
  dec: string | null;
  completeness: string | null;
  reviewedCadence: string | null;
  reviewedCadenceUnit: string | null;
  fxt1WindowMode: string | null;
  fxt1Filter: string | null;
  fxt2WindowMode: string | null;
  fxt2Filter: string | null;
  wxtCmos: string | null;
  wxtCmosX: string | null;
  wxtCmosY: string | null;
  fxtCmr: string | null;
  fxtX: string | null;
  fxtY: string | null;
  generatedEpDbObjectId: string;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  totalExposureTime: number;
  totalExposureTimeAll: number;
  totalVisits: number;
};

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
  if (sourceType === "SingleObs") return totalExposureS <= 3000 ? "GP-PPT-ST" : "GP-PPT-LT";
  return "ToO-GP";
}

function normalizeFxtCmr(value: string | null): string | null {
  if (value === "FXTA") return "A";
  if (value === "FXTB") return "B";
  return null;
}

function parseCadence(rawCadence: string | null, rawUnit: string | null): { cadence: number | null; cadenceUnit: "day" | "orbit" | null } {
  const cadence = rawCadence != null ? Number(rawCadence) : NaN;
  const unit = (rawUnit ?? "").trim().toLowerCase();
  if (!unit || !Number.isFinite(cadence) || cadence <= 0) return { cadence: null, cadenceUnit: null };
  if (unit === "day" || unit === "days") return { cadence, cadenceUnit: "day" };
  if (unit === "orbit" || unit === "orbits") return { cadence, cadenceUnit: "orbit" };
  return { cadence: null, cadenceUnit: null };
}

function computePrecision(cadence: number | null, cadenceUnit: "day" | "orbit" | null): { precision: number | null; precisionUnit: "day" | "orbit" | null } {
  if (cadence == null || cadenceUnit == null) return { precision: null, precisionUnit: null };
  if (cadenceUnit === "orbit") {
    return { precision: Math.ceil(cadence / 10), precisionUnit: "orbit" };
  }

  if (cadence >= 5) {
    return { precision: Math.ceil(cadence / 10), precisionUnit: "day" };
  }

  const cadenceOrbit = (cadence / 10) * (1440 / 97);
  return { precision: Math.ceil(cadenceOrbit), precisionUnit: "orbit" };
}

function groupTooGpRows(rows: TooGpRawRow[]): TooGpGroupedRow[] {
  const grouped = new Map<string, TooGpGroupedRow>();

  for (const row of rows) {
    // Source view: aggregate by source identity within this session week.
    const key = row.sourceId ?? row.generatedEpDbObjectId ?? row.sourceName ?? String(row.id);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceType: row.sourceType,
        pi: row.pi,
        groupName: row.groupName,
        proposalId: row.proposalId,
        proposalNo: row.proposalNo,
        ra: row.ra,
        dec: row.dec,
        completeness: row.completeness,
        reviewedCadence: row.reviewedCadence,
        reviewedCadenceUnit: row.reviewedCadenceUnit,
        fxt1WindowMode: row.fxt1WindowMode,
        fxt1Filter: row.fxt1Filter,
        fxt2WindowMode: row.fxt2WindowMode,
        fxt2Filter: row.fxt2Filter,
        wxtCmos: row.wxtCmos,
        wxtCmosX: row.wxtCmosX,
        wxtCmosY: row.wxtCmosY,
        fxtCmr: row.fxtCmr,
        fxtX: row.fxtX,
        fxtY: row.fxtY,
        generatedEpDbObjectId: row.generatedEpDbObjectId,
        plannedStartTime: row.plannedStartTime,
        plannedEndTime: row.plannedEndTime,
        totalExposureTime: row.reviewedSingleExposureTimeSnapshot ?? 0,
        totalExposureTimeAll: row.reviewedTotalExposureTimeSnapshot ?? 0,
        totalVisits: row.reviewedNumberOfVisitsSnapshot ?? 0,
      });
      continue;
    }

    existing.totalExposureTime += row.reviewedSingleExposureTimeSnapshot ?? 0;
    existing.totalExposureTimeAll += row.reviewedTotalExposureTimeSnapshot ?? 0;
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

function escapeCsvCell(val: string | null | undefined): string {
  const s = val ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvRow(row: SourceRow, weekDates: string[]): string {
  const cells = [
    escapeCsvCell(String(row.id)),
    escapeCsvCell(row.sourceId),
    escapeCsvCell(row.proposalId),
    escapeCsvCell(row.proposalNo),
    escapeCsvCell(row.epDbObjectId),
    escapeCsvCell(row.pi),
    escapeCsvCell(row.groupName),
    escapeCsvCell(row.sourceName),
    escapeCsvCell(row.obsType),
    escapeCsvCell(row.ra),
    escapeCsvCell(row.dec),
    escapeCsvCell(row.totalExposureTime),
    escapeCsvCell(row.totalExposureTimeAll),
    escapeCsvCell(row.exposureTimeUnit),
    escapeCsvCell(row.continousExposure),
    escapeCsvCell(row.visitNumber),
    escapeCsvCell(row.exposurePerVistMin),
    escapeCsvCell(row.exposurePerVistMax),
    escapeCsvCell(row.completeness),
    escapeCsvCell(row.cadence),
    escapeCsvCell(row.cadenceUnit),
    escapeCsvCell(row.precision),
    escapeCsvCell(row.precisionUnit),
    escapeCsvCell(row.startTime),
    escapeCsvCell(row.endTime),
    escapeCsvCell(row.sourcePriority),
    escapeCsvCell(row.fxt1WindowMode),
    escapeCsvCell(row.fxt1Filter),
    escapeCsvCell(row.fxt2WindowMode),
    escapeCsvCell(row.fxt2Filter),
    escapeCsvCell(row.isUpdated),
    escapeCsvCell(row.payload),
    escapeCsvCell(row.wxtCmos),
    escapeCsvCell(row.wxtCmosX),
    escapeCsvCell(row.wxtCmosY),
    escapeCsvCell(row.fxtCmr),
    escapeCsvCell(row.fxtX),
    escapeCsvCell(row.fxtY),
    escapeCsvCell(row.isForDisrupted),
    // 7 daily visibility columns (blank)
    ...weekDates.map(() => ""),
    // sum_orbit (blank)
    "",
  ];
  return cells.join(",");
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const cycleTables = getCycleTables(ACTIVE_CYCLE);
    const longTermCycle = cycleTables.longTerm;
    const longTermGf = cycleTables.longTermGf;

    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const authSession = token ? await verifySessionToken(token) : null;
    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [planSession] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!planSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const excludedCycle2 = new Set<number>(planSession.excludedCycle2Ids);
    const excludedGf = new Set<number>(planSession.excludedGfIds);
    const excludedTooGp = new Set<number>(planSession.excludedTooGpIds ?? []);
    const sessionWeekNum = parseInt(planSession.weekId.replace(/\D/g, ""), 10);

    // Fetch sources for the session's week
    const [cycle2Rows, gfRows, tooGpAllRows] = await Promise.all([
      db
        .select()
        .from(longTermCycle)
        .where(eq(longTermCycle.weekId, planSession.weekId)),
      db
        .select()
        .from(longTermGf)
        .where(eq(longTermGf.weekId, planSession.weekId)),
      db
        .select({
          id: tooToGpSchedule.id,
          sourceId: approvedToO.sourceId,
          sourceName: approvedToO.sourceName,
          sourceType: approvedToO.sourceType,
          pi: approvedToO.pi,
          groupName: approvedToO.groupName,
          proposalId: approvedToO.proposalId,
          proposalNo: approvedToO.proposalNo,
          ra: approvedToO.ra,
          dec: approvedToO.dec,
          completeness: approvedToO.completeness,
          reviewedCadence: approvedToO.reviewedCadence,
          reviewedCadenceUnit: approvedToO.reviewedCadenceUnit,
          fxt1WindowMode: approvedToO.fxt1WindowMode,
          fxt1Filter: approvedToO.fxt1Filter,
          fxt2WindowMode: approvedToO.fxt2WindowMode,
          fxt2Filter: approvedToO.fxt2Filter,
          wxtCmos: approvedToO.wxtCmos,
          wxtCmosX: approvedToO.wxtCmosX,
          wxtCmosY: approvedToO.wxtCmosY,
          fxtCmr: approvedToO.fxtCmr,
          fxtX: approvedToO.fxtX,
          fxtY: approvedToO.fxtY,
          generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
          plannedStartTime: tooToGpSchedule.plannedStartTime,
          plannedEndTime: tooToGpSchedule.plannedEndTime,
          reviewedSingleExposureTimeSnapshot: tooToGpSchedule.reviewedSingleExposureTimeSnapshot,
          reviewedTotalExposureTimeSnapshot: tooToGpSchedule.reviewedTotalExposureTimeSnapshot,
          reviewedNumberOfVisitsSnapshot: tooToGpSchedule.reviewedNumberOfVisitsSnapshot,
          status: tooToGpSchedule.status,
          scheduledStatus: sql<"scheduled" | "queued">`
            CASE
              WHEN EXISTS (
                SELECT 1 FROM obs_wp o
                WHERE POSITION(${tooToGpSchedule.generatedEpDbObjectId} IN COALESCE(o.ep_db_object_id, '')) > 0
              ) THEN 'scheduled'
              ELSE 'queued'
            END
          `,
        })
        .from(tooToGpSchedule)
        .innerJoin(approvedToO, eq(approvedToO.id, tooToGpSchedule.approvedTooId)),
    ]);

    // Filter tooGp: match week + scheduledStatus=queued + not excluded
    const filteredTooGpRows: TooGpRawRow[] = tooGpAllRows
      .filter((r) => {
        const rowWeekNum = getWeekNumFromDate(r.plannedStartTime);
        return rowWeekNum !== null && rowWeekNum === sessionWeekNum && r.scheduledStatus === "queued" && !excludedTooGp.has(r.id);
      })
      .map((r) => ({
        ...r,
        sourceType: r.sourceType ?? null,
        completeness: r.completeness ?? null,
        reviewedCadence: r.reviewedCadence ?? null,
        reviewedCadenceUnit: r.reviewedCadenceUnit ?? null,
      }));

    const tooGpRows = groupTooGpRows(filteredTooGpRows).map((r, index): SourceRow => {
      const normalizedFxtCmr = normalizeFxtCmr(r.fxtCmr ?? null);
      const payload = normalizedFxtCmr ? "FXT" : (r.wxtCmos ? "WXT" : null);
      const cadenceInfo = parseCadence(r.reviewedCadence ?? null, r.reviewedCadenceUnit ?? null);
      const precisionInfo = computePrecision(cadenceInfo.cadence, cadenceInfo.cadenceUnit);
      const totalExp = r.totalExposureTime;

      return {
        id: 900000 + index,
        sourceId: r.sourceId ?? null,
        proposalId: r.proposalId ?? null,
        proposalNo: r.proposalNo ?? null,
        epDbObjectId: r.generatedEpDbObjectId,
        pi: r.pi ?? null,
        groupName: r.groupName ?? null,
        sourceName: r.sourceName ?? null,
        obsType: classifyTooGpObsType(r.sourceType, totalExp),
        ra: r.ra ?? null,
        dec: r.dec ?? null,
        totalExposureTime: String(totalExp),
        totalExposureTimeAll: String(r.totalExposureTimeAll),
        exposureTimeUnit: "second",
        continousExposure: null,
        visitNumber: String(r.totalVisits),
        exposurePerVistMin: String(Math.ceil(totalExp * 0.8)),
        exposurePerVistMax: String(Math.ceil(totalExp * 1.2)),
        completeness: r.completeness ?? null,
        cadence: cadenceInfo.cadence != null ? String(cadenceInfo.cadence) : null,
        cadenceUnit: cadenceInfo.cadenceUnit,
        precision: precisionInfo.precision != null ? String(precisionInfo.precision) : null,
        precisionUnit: precisionInfo.precisionUnit,
        startTime: formatDateAsStartOfDay(r.plannedStartTime),
        endTime: formatDateAsStartOfDay(r.plannedEndTime),
        sourcePriority: "A",
        fxt1WindowMode: r.fxt1WindowMode ?? null,
        fxt1Filter: r.fxt1Filter ?? null,
        fxt2WindowMode: r.fxt2WindowMode ?? null,
        fxt2Filter: r.fxt2Filter ?? null,
        isUpdated: null,
        payload,
        wxtCmos: r.wxtCmos ?? null,
        wxtCmosX: r.wxtCmosX ?? null,
        wxtCmosY: r.wxtCmosY ?? null,
        fxtCmr: normalizedFxtCmr,
        fxtX: r.fxtX ?? null,
        fxtY: r.fxtY ?? null,
        isForDisrupted: "false",
      };
    });

    const selectedCycle2 = cycle2Rows.filter((r) => !excludedCycle2.has(r.id));
    const selectedGf = gfRows.filter((r) => !excludedGf.has(r.id));
    const allRows: SourceRow[] = [...selectedCycle2, ...selectedGf, ...tooGpRows];

    // Determine the week date range for column headers
    // Try to derive from start_time of sources, fallback to a calculated estimate
    const allStartTimes = allRows.map((r) => r.startTime).filter(Boolean) as string[];
    let weekStartDate: Date;
    if (allStartTimes.length > 0) {
      const earliest = allStartTimes.sort()[0];
      weekStartDate = new Date(earliest);
    } else {
      // Estimate: WK42 = 2026-05-26; each week = 7 days
      const wkNum = parseInt(planSession.weekId.replace(/\D/g, ""), 10) || 42;
      const wk42Start = new Date("2026-05-26T00:00:00Z");
      weekStartDate = new Date(wk42Start.getTime() + (wkNum - 42) * 7 * 24 * 60 * 60 * 1000);
    }
    weekStartDate.setUTCHours(0, 0, 0, 0);

    const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate.getTime() + i * 24 * 60 * 60 * 1000);
      return `${d.toISOString().slice(0, 10)}T22:00:00`;
    });

    // Build CSV headers
    const headers = [
      "id",
      "source_id",
      "proposal_id",
      "proposal_no",
      "EP_DB_OBJECT_ID",
      "pi",
      "group",
      "source_name",
      "obs_type",
      "ra",
      "dec",
      "total_exposure_time",
      "total_exposure_time_all",
      "exposure_time_unit",
      "continous_exposure",
      "visit_number",
      "exposure_per_vist_min",
      "exposure_per_vist_max",
      "completeness",
      "cadence",
      "cadence_unit",
      "precision",
      "precision_unit",
      "start_time",
      "end_time",
      "source_priority",
      "fxt1_window_mode",
      "fxt1_filter",
      "fxt2_window_mode",
      "fxt2_filter",
      "is_updated",
      "Payload",
      "WXT_CMOS",
      "WXT_CMOS_X",
      "WXT_CMOS_Y",
      "FXT_CMR",
      "FXT_X",
      "FXT_Y",
      "is_for_disrupted",
      ...weekDates,
      "sum_orbit",
    ];

    const lines: string[] = [headers.join(",")];
    for (const row of allRows) {
      lines.push(buildCsvRow(row, weekDates));
    }
    const csvText = lines.join("\r\n");

    // Persist the CSV text to the session
    await db
      .update(shortTermPlanSessions)
      .set({
        mergedCsvText: csvText,
        updatedAt: sql`now()`,
      })
      .where(eq(shortTermPlanSessions.id, sessionId));

    const filename = `reviewed_cycle${ACTIVE_CYCLE}_source_list_${planSession.weekId.toLowerCase()}_v1.csv`;
    return new Response(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate CSV" },
      { status: 500 },
    );
  }
}
