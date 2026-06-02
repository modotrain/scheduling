import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { ACTIVE_CYCLE, getCycleEpoch } from "@/app/lib/cycles";
import { db } from "@/src/db/client";
import { approvedToO, shortTermPlanSessions, tooToGpSchedule } from "@/src/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

const FALLBACK_EPOCH = "2025-08-12";

function getWeekNumFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr.split("T")[0]! : dateStr.split(" ")[0]!;
  const d = new Date(`${normalized}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  // Roll back to the preceding Tuesday (day index 2)
  const dayOfWeek = d.getUTCDay(); // 0=Sun,1=Mon,2=Tue,...
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesdayMs = d.getTime() - daysSinceTuesday * 86_400_000;
  const epochMs = new Date(`${getCycleEpoch(ACTIVE_CYCLE) ?? FALLBACK_EPOCH}T00:00:00Z`).getTime();
  return Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [planSession] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!planSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const sessionWeekNum = parseInt(planSession.weekId.replace(/\D/g, ""), 10);

    // Query all tooToGpSchedule rows joined with approvedToO for metadata
    const allRows = await db
      .select({
        id: tooToGpSchedule.id,
        approvedTooId: tooToGpSchedule.approvedTooId,
        sourceName: approvedToO.sourceName,
        sourceId: approvedToO.sourceId,
        pi: approvedToO.pi,
        sourceType: approvedToO.sourceType,
        completeness: approvedToO.completeness,
        reviewedCadence: approvedToO.reviewedCadence,
        reviewedCadenceUnit: approvedToO.reviewedCadenceUnit,
        fxtCmr: approvedToO.fxtCmr,
        wxtCmos: approvedToO.wxtCmos,
        ra: approvedToO.ra,
        dec: approvedToO.dec,
        parentEpDbObjectId: tooToGpSchedule.parentEpDbObjectId,
        generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
        sequenceNo: tooToGpSchedule.sequenceNo,
        plannedStartTime: tooToGpSchedule.plannedStartTime,
        plannedEndTime: tooToGpSchedule.plannedEndTime,
        reviewedNumberOfVisitsSnapshot: tooToGpSchedule.reviewedNumberOfVisitsSnapshot,
        reviewedSingleExposureTimeSnapshot: tooToGpSchedule.reviewedSingleExposureTimeSnapshot,
        reviewedTotalExposureTimeSnapshot: tooToGpSchedule.reviewedTotalExposureTimeSnapshot,
        status: tooToGpSchedule.status,
        // Same scheduledStatus logic as /api/tootogp-schedule/route.ts
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
      .innerJoin(approvedToO, eq(approvedToO.id, tooToGpSchedule.approvedTooId));

    // Filter: matching week number AND scheduledStatus = 'queued' (mirrors the tootogp-schedule page filter)
    const filtered = allRows.filter((r) => {
      if (r.scheduledStatus !== "queued") return false;
      const rowWeekNum = getWeekNumFromDate(r.plannedStartTime);
      return rowWeekNum !== null && rowWeekNum === sessionWeekNum;
    });

    const excludedSet = new Set<number>(planSession.excludedTooGpIds ?? []);

    const rows = filtered.map((r) => ({
      ...r,
      isExcluded: excludedSet.has(r.id),
    }));

    const included = rows.filter((r) => !r.isExcluded);
    const stats = {
      count: included.length,
      totalCount: rows.length,
      totalExposureS: included.reduce((sum, r) => sum + (r.reviewedSingleExposureTimeSnapshot ?? 0), 0),
    };

    return NextResponse.json({ rows, stats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch ToO-GP sources" },
      { status: 500 },
    );
  }
}
