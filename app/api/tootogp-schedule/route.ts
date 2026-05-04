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
        operatorName: tooToGpSchedule.operatorName,
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
        scheduledStatus: sql<"scheduled" | "unscheduled">`
          case
            when exists (
              select 1
              from obs_wp o
              where o.ep_db_object_id is not null
                and o.ep_db_object_id ilike '%' || ${tooToGpSchedule.generatedEpDbObjectId} || '%'
            ) then 'scheduled'
            else 'unscheduled'
          end
        `,
        matchedObsWpId: sql<number | null>`(
          select o.id
          from obs_wp o
          where o.ep_db_object_id is not null
            and o.ep_db_object_id ilike '%' || ${tooToGpSchedule.generatedEpDbObjectId} || '%'
          order by o.id desc
          limit 1
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