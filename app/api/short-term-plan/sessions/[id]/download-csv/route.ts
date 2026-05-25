import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import {
  longTermObservationListCycle2,
  longTermObservationListCycle2GF,
  shortTermPlanSessions,
} from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

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

    // Fetch sources for the session's week
    const [cycle2Rows, gfRows] = await Promise.all([
      db
        .select()
        .from(longTermObservationListCycle2)
        .where(eq(longTermObservationListCycle2.weekId, planSession.weekId)),
      db
        .select()
        .from(longTermObservationListCycle2GF)
        .where(eq(longTermObservationListCycle2GF.weekId, planSession.weekId)),
    ]);

    const selectedCycle2 = cycle2Rows.filter((r) => !excludedCycle2.has(r.id));
    const selectedGf = gfRows.filter((r) => !excludedGf.has(r.id));
    const allRows: SourceRow[] = [...selectedCycle2, ...selectedGf];

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

    const filename = `reviewed_cycle2_source_list_${planSession.weekId.toLowerCase()}_v1.csv`;
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
