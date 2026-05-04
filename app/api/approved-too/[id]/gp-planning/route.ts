import { asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { approvedToO, tooToGpSchedule } from "@/src/db/schema";

type Params = { params: Promise<{ id: string }> };

function parseInteger(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCadenceUnit(value: string | null | undefined): "day" | "orbit" | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "day" || normalized === "days") {
    return "day";
  }
  if (normalized === "orbit" || normalized === "orbits") {
    return "orbit";
  }
  return null;
}

function toIsoString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addMinutes(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
}

function addSeconds(startIso: string, seconds: number): string {
  return new Date(new Date(startIso).getTime() + seconds * 1_000).toISOString();
}

function cadenceToMinutes(cadenceValue: number | null, cadenceUnit: "day" | "orbit" | null): number {
  if (!cadenceValue || cadenceValue <= 0 || !cadenceUnit) {
    return 0;
  }

  if (cadenceUnit === "orbit") {
    return cadenceValue * 97;
  }

  return cadenceValue * 24 * 60;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id: tooToGpSchedule.id,
        approvedTooId: tooToGpSchedule.approvedTooId,
        sourceName: approvedToO.sourceName,
        parentEpDbObjectId: tooToGpSchedule.parentEpDbObjectId,
        generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
        sequenceNo: tooToGpSchedule.sequenceNo,
        earliestStartTime: tooToGpSchedule.earliestStartTime,
        plannedStartTime: tooToGpSchedule.plannedStartTime,
        plannedEndTime: tooToGpSchedule.plannedEndTime,
        cadenceValue: tooToGpSchedule.cadenceValue,
        cadenceUnit: tooToGpSchedule.cadenceUnit,
        reviewedNumberOfVisitsSnapshot: tooToGpSchedule.reviewedNumberOfVisitsSnapshot,
        reviewedSingleExposureTimeSnapshot: tooToGpSchedule.reviewedSingleExposureTimeSnapshot,
        reviewedTotalExposureTimeSnapshot: tooToGpSchedule.reviewedTotalExposureTimeSnapshot,
        status: tooToGpSchedule.status,
        notes: tooToGpSchedule.notes,
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
      .where(eq(tooToGpSchedule.approvedTooId, numId))
      .orderBy(asc(tooToGpSchedule.sequenceNo), asc(tooToGpSchedule.id));

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch GP planning" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      earliestStartTime?: string | null;
      notes?: string | null;
    };

    const [parent] = await db.select().from(approvedToO).where(eq(approvedToO.id, numId));
    if (!parent) {
      return NextResponse.json({ error: "Approved ToO not found" }, { status: 404 });
    }

    if (!parent.epDbObjectId?.trim()) {
      return NextResponse.json(
        { error: "EP DB Object ID is required before creating GP planning records" },
        { status: 400 },
      );
    }

    const [latestPlan] = await db
      .select({
        sequenceNo: tooToGpSchedule.sequenceNo,
        plannedStartTime: tooToGpSchedule.plannedStartTime,
        plannedEndTime: tooToGpSchedule.plannedEndTime,
      })
      .from(tooToGpSchedule)
      .where(eq(tooToGpSchedule.approvedTooId, numId))
      .orderBy(desc(tooToGpSchedule.sequenceNo), desc(tooToGpSchedule.id))
      .limit(1);

    const sequenceNo = (latestPlan?.sequenceNo ?? 0) + 1;
    const cadenceValue = parseInteger(parent.reviewedCadence);
    const cadenceUnit = normalizeCadenceUnit(parent.reviewedCadenceUnit);
    const reviewedNumberOfVisitsSnapshot = parseInteger(parent.reviewedNumberOfVisits);
    const reviewedSingleExposureTimeSnapshot = parseInteger(parent.reviewedSingleExposureTime);
    const reviewedTotalExposureTimeSnapshot = parseInteger(parent.reviewedTotalExposureTime);

    const explicitEarliestStart = toIsoString(body.earliestStartTime);
    if (body.earliestStartTime && !explicitEarliestStart) {
      return NextResponse.json({ error: "Invalid earliest start time" }, { status: 400 });
    }

    const cadenceMinutes = cadenceToMinutes(cadenceValue, cadenceUnit);
    const fallbackStart = latestPlan?.plannedStartTime
      ? cadenceMinutes > 0
        ? addMinutes(latestPlan.plannedStartTime, cadenceMinutes)
        : latestPlan.plannedEndTime ?? latestPlan.plannedStartTime
      : new Date().toISOString();
    const plannedStartTime = explicitEarliestStart ?? fallbackStart;
    const plannedEndTime =
      reviewedSingleExposureTimeSnapshot && reviewedSingleExposureTimeSnapshot > 0
        ? addSeconds(plannedStartTime, reviewedSingleExposureTimeSnapshot)
        : null;

    const [inserted] = await db
      .insert(tooToGpSchedule)
      .values({
        approvedTooId: numId,
        parentEpDbObjectId: parent.epDbObjectId.trim(),
        generatedEpDbObjectId: `${parent.epDbObjectId.trim()}_${sequenceNo}`,
        sequenceNo,
        earliestStartTime: explicitEarliestStart ?? plannedStartTime,
        plannedStartTime,
        plannedEndTime,
        cadenceValue,
        cadenceUnit,
        reviewedNumberOfVisitsSnapshot,
        reviewedSingleExposureTimeSnapshot,
        reviewedTotalExposureTimeSnapshot,
        notes: body.notes?.trim() ? body.notes.trim() : null,
      })
      .returning();

    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create GP planning record" },
      { status: 500 },
    );
  }
}