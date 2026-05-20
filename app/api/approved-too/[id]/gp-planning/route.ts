import { asc, desc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";
import { approvedToO, tooToGpSchedule, usersTable } from "@/src/db/schema";

type Params = { params: Promise<{ id: string }> };

type PlanningPayload = {
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  notes?: string | null;
  cadenceValue?: number | null;
  cadenceUnit?: string | null;
  reviewedSingleExposureTimeSnapshot?: number | null;
  numberOfGpVisits?: number | null;
};

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

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function getDefaultTuesdayWindow(): { start: string; end: string } {
  const reference = new Date();
  reference.setUTCDate(reference.getUTCDate() + 3);

  const day = reference.getUTCDay();
  const daysUntilTuesday = (2 - day + 7) % 7;
  reference.setUTCDate(reference.getUTCDate() + daysUntilTuesday);

  const start = [reference.getUTCFullYear(), String(reference.getUTCMonth() + 1).padStart(2, "0"), String(reference.getUTCDate()).padStart(2, "0")].join("-");
  return { start, end: addDays(start, 7) };
}

function buildGeneratedId(epDbObjectId: string, seqNo: number): string {
  const normalized = epDbObjectId.trim();
  const match = normalized.match(/^EP_ToO_Season-\d+-([^-]+)-([^-]+)$/i);

  if (match) {
    const [, secondPart, thirdPart] = match;
    return `cycle2-${secondPart}_${thirdPart}_${seqNo}_ToO`;
  }

  const base = normalized.replace(/^EP_ToO_Season/i, "cycle2");
  return `${base}_${seqNo}_ToO`;
}

function cadenceToDays(cadenceValue: number | null, cadenceUnit: "day" | "orbit" | null): number {
  if (!cadenceValue || cadenceValue <= 0) return 0;
  if (cadenceUnit === "orbit") return (cadenceValue * 97 * 60) / 86_400;
  return cadenceValue;
}

function addFractionalDays(dateString: string, days: number): string {
  const ms = new Date(`${dateString}T00:00:00Z`).getTime() + days * 86_400_000;
  const d = new Date(ms);
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0")].join("-");
}

function dateDiffDays(a: string, b: string): number {
  return (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;
}

function getTuesdayWindowForDateString(dateString: string): { start: string; end: string } {
  const d = new Date(`${dateString}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesday = new Date(d.getTime() - daysSinceTuesday * 86_400_000);
  const start = [tuesday.getUTCFullYear(), String(tuesday.getUTCMonth() + 1).padStart(2, "0"), String(tuesday.getUTCDate()).padStart(2, "0")].join("-");
  return { start, end: addDays(start, 7) };
}

function computeAllVisitWindows(
  firstStart: string,
  firstEnd: string,
  numberOfVisits: number,
  cadenceDays: number,
): Array<{ start: string; end: string; weekStart: string }> {
  const rangeDays = dateDiffDays(firstStart, firstEnd);

  // Step 1: how many visits fit in the first week
  let numberInFirstWeek: number;
  if (cadenceDays <= 0 || cadenceDays >= 7) {
    numberInFirstWeek = 1;
  } else {
    numberInFirstWeek = Math.max(1, Math.ceil((rangeDays - 1) / cadenceDays));
  }

  // Step 2: narrow the actual first range
  const actualStart = firstStart;
  let actualEnd = addFractionalDays(firstEnd, -(cadenceDays * (numberInFirstWeek - 1)));
  if (dateDiffDays(actualStart, actualEnd) < 1) {
    actualEnd = addDays(actualStart, 1);
  }

  // Step 3: anchor point at 1/3 of actual range
  const actualDurationDays = dateDiffDays(actualStart, actualEnd);
  const time1 = addFractionalDays(actualStart, Math.floor(actualDurationDays / 3));

  // Step 4: per-visit window = intersection(week window, cadence-shifted actual range)
  return Array.from({ length: numberOfVisits }, (_, n) => {
    const timeN = addFractionalDays(time1, cadenceDays * n);
    const weekWindow = getTuesdayWindowForDateString(timeN);
    const shiftedStart = addFractionalDays(actualStart, cadenceDays * n);
    const shiftedEnd = addFractionalDays(actualEnd, cadenceDays * n);

    const intStart = shiftedStart > weekWindow.start ? shiftedStart : weekWindow.start;
    const intEnd = shiftedEnd < weekWindow.end ? shiftedEnd : weekWindow.end;
    const weekStart = weekWindow.start;
    if (intStart < intEnd) {
      return { start: intStart, end: intEnd, weekStart };
    }
    // Fallback: use shifted actual range if intersection is empty
    return { start: shiftedStart, end: shiftedEnd, weekStart };
  });
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
        operatorName: tooToGpSchedule.operatorName,
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
        updatedAt: tooToGpSchedule.updatedAt,
        scheduledStatus: sql<"scheduled" | "queued">`
          CASE
            WHEN EXISTS (
              SELECT 1 FROM obs_wp o
              WHERE POSITION(${tooToGpSchedule.generatedEpDbObjectId} IN COALESCE(o.ep_db_object_id, '')) > 0
            ) THEN 'scheduled'
            ELSE 'queued'
          END
        `,
        matchedObsWpId: sql<number | null>`(
          SELECT o.id FROM obs_wp o
          WHERE POSITION(${tooToGpSchedule.generatedEpDbObjectId} IN COALESCE(o.ep_db_object_id, '')) > 0
          ORDER BY o.id DESC
          LIMIT 1
        )`,
        matchedObsWpCount: sql<number>`(
          SELECT COUNT(*)::int FROM obs_wp o
          WHERE POSITION(${tooToGpSchedule.generatedEpDbObjectId} IN COALESCE(o.ep_db_object_id, '')) > 0
        )`,
        matchedObsWpIds: sql<number[]>`
          COALESCE((
            SELECT ARRAY_AGG(o.id ORDER BY o.id DESC)
            FROM obs_wp o
            WHERE POSITION(${tooToGpSchedule.generatedEpDbObjectId} IN COALESCE(o.ep_db_object_id, '')) > 0
          ), ARRAY[]::integer[])
        `,
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
    const body = (await request.json()) as PlanningPayload;
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    const explicitStart = toDateOnly(body.plannedStartTime);
    const explicitEnd = toDateOnly(body.plannedEndTime);
    if (body.plannedStartTime && !explicitStart) {
      return NextResponse.json({ error: "Invalid planned start date" }, { status: 400 });
    }
    if (body.plannedEndTime && !explicitEnd) {
      return NextResponse.json({ error: "Invalid planned end date" }, { status: 400 });
    }

    const [parent] = await db.select().from(approvedToO).where(eq(approvedToO.id, numId));
    if (!parent) {
      return NextResponse.json({ error: "Approved ToO not found" }, { status: 404 });
    }

    const [operator] = session
      ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.username, session.username)).limit(1)
      : [];

    if (!parent.epDbObjectId?.trim()) {
      return NextResponse.json(
        { error: "EP_DB_Object_ID is required before creating GP planning records" },
        { status: 400 },
      );
    }

    const parentEpDbObjectId = parent.epDbObjectId.trim();
    const cadenceValue = body.cadenceValue !== undefined ? body.cadenceValue : parseInteger(parent.reviewedCadence);
    const cadenceUnit = normalizeCadenceUnit(body.cadenceUnit ?? parent.reviewedCadenceUnit);
    const numberOfGpVisits = Math.max(1, Math.round(body.numberOfGpVisits ?? 1));
    const singleExp =
      body.reviewedSingleExposureTimeSnapshot ?? parseInteger(parent.reviewedSingleExposureTime);

    const defaultWindow = getDefaultTuesdayWindow();
    const firstStart = explicitStart ?? defaultWindow.start;
    const firstEnd = explicitEnd ?? addDays(firstStart, 7);

    let inserted: typeof tooToGpSchedule.$inferSelect[] | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [latestPlan] = await db
        .select({
          sequenceNo: tooToGpSchedule.sequenceNo,
          reviewedNumberOfVisitsSnapshot: tooToGpSchedule.reviewedNumberOfVisitsSnapshot,
        })
        .from(tooToGpSchedule)
        .where(eq(tooToGpSchedule.approvedTooId, numId))
        .orderBy(desc(tooToGpSchedule.sequenceNo), desc(tooToGpSchedule.id))
        .limit(1);

      // sequenceNoBase = cumulative starting position for the new batch.
      // Each existing row's seqNo is the start of its week group, so the next
      // available cumulative position = lastSeqNo + visitsInThatWeek.
      const sequenceNoBase = latestPlan
        ? latestPlan.sequenceNo + (latestPlan.reviewedNumberOfVisitsSnapshot ?? 1)
        : 1;

      // Compute one window per individual visit (intersection of week window
      // and cadence-shifted actual first range).
      const cadenceDays = cadenceToDays(cadenceValue, cadenceUnit);
      const visitWindows = computeAllVisitWindows(firstStart, firstEnd, numberOfGpVisits, cadenceDays);

      // Assign sequenceNos, then determine the first seqNo per week so all
      // visits in the same week share the same generatedEpDbObjectId.
      let seq = sequenceNoBase;
      const visitsWithSeq = visitWindows.map((w) => ({ ...w, seqNo: seq++ }));
      const weekFirstSeq = new Map<string, number>();
      for (const v of visitsWithSeq) {
        if (!weekFirstSeq.has(v.weekStart)) {
          weekFirstSeq.set(v.weekStart, v.seqNo);
        }
      }

      // One DB row per visit; visits in the same week share generatedEpDbObjectId.
      const insertValues = visitsWithSeq.map((v) => {
        const weekSeqNo = weekFirstSeq.get(v.weekStart)!;
        return {
          approvedTooId: numId,
          operatorName: operator?.name ?? session?.username ?? null,
          parentEpDbObjectId,
          generatedEpDbObjectId: buildGeneratedId(parentEpDbObjectId, weekSeqNo),
          sequenceNo: v.seqNo,
          earliestStartTime: v.start,
          plannedStartTime: v.start,
          plannedEndTime: v.end,
          cadenceValue,
          cadenceUnit,
          reviewedNumberOfVisitsSnapshot: 1,
          reviewedSingleExposureTimeSnapshot: singleExp,
          reviewedTotalExposureTimeSnapshot: singleExp,
          notes: body.notes?.trim() ? body.notes.trim() : null,
        };
      });

      try {
        inserted = await db.insert(tooToGpSchedule).values(insertValues).returning();
        break;
      } catch (attemptErr) {
        const attemptCause =
          typeof attemptErr === "object" && attemptErr !== null && "cause" in attemptErr
            ? (attemptErr as { cause?: { message?: string; code?: string; detail?: string } }).cause
            : null;
        const attemptDetails = [attemptCause?.message, attemptCause?.detail].filter(Boolean).join(" ").trim();
        const isUniqueViolation =
          attemptCause?.code === "23505" || attemptDetails.toLowerCase().includes("duplicate key value");

        if (isUniqueViolation && attempt < 2) {
          continue;
        }
        throw attemptErr;
      }
    }

    if (!inserted) {
      throw new Error("Failed to create GP planning records after retries");
    }

    return NextResponse.json({ rows: inserted }, { status: 201 });
  } catch (err) {
    const cause =
      typeof err === "object" && err !== null && "cause" in err
        ? (err as { cause?: { message?: string; code?: string; detail?: string } }).cause
        : null;
    const details = [cause?.message, cause?.detail].filter(Boolean).join(" ").trim();
    const isUniqueViolation = cause?.code === "23505" || details.toLowerCase().includes("duplicate key value");

    return NextResponse.json(
      {
        error: isUniqueViolation
          ? `GP planning records conflict with existing sequence numbers or generated IDs. ${details || "Please retry."}`.trim()
          : err instanceof Error
            ? details
              ? `${err.message}: ${details}`
              : err.message
            : "Failed to create GP planning record",
      },
      { status: isUniqueViolation ? 409 : 500 },
    );
  }
}