import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { approvedToO, tooToGpSchedule } from "@/src/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: tooToGpSchedule.id,
        approvedTooId: tooToGpSchedule.approvedTooId,
        pi: approvedToO.pi,
        sourceName: approvedToO.sourceName,
        parentEpDbObjectId: tooToGpSchedule.parentEpDbObjectId,
        generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
        sequenceNo: tooToGpSchedule.sequenceNo,
        plannedStartTime: tooToGpSchedule.plannedStartTime,
        plannedEndTime: tooToGpSchedule.plannedEndTime,
        cadenceValue: tooToGpSchedule.cadenceValue,
        cadenceUnit: tooToGpSchedule.cadenceUnit,
        reviewedSingleExposureTimeSnapshot: tooToGpSchedule.reviewedSingleExposureTimeSnapshot,
        reviewedTotalExposureTimeSnapshot: tooToGpSchedule.reviewedTotalExposureTimeSnapshot,
        status: tooToGpSchedule.status,
        scheduledStatus: sql<"scheduled" | "queued">`
          CASE
            WHEN EXISTS (
              SELECT 1 FROM obs_wp o
              WHERE o.ep_db_object_id = REGEXP_REPLACE(${tooToGpSchedule.generatedEpDbObjectId}, '_ToO$', '')
            ) THEN 'scheduled'
            ELSE 'queued'
          END
        `,
        matchedObsWpId: sql<number | null>`(
          SELECT o.id FROM obs_wp o
          WHERE o.ep_db_object_id = REGEXP_REPLACE(${tooToGpSchedule.generatedEpDbObjectId}, '_ToO$', '')
          ORDER BY o.id DESC
          LIMIT 1
        )`,
      })
      .from(tooToGpSchedule)
      .innerJoin(approvedToO, eq(approvedToO.id, tooToGpSchedule.approvedTooId))
      .orderBy(asc(tooToGpSchedule.approvedTooId), asc(tooToGpSchedule.sequenceNo), asc(tooToGpSchedule.id));

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch GP planning list" },
      { status: 500 },
    );
  }
}