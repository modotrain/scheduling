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

function getTuesdayWindowForMs(tsMs: number): { start: string; end: string } {
  const d = new Date(tsMs);
  const dayOfWeek = d.getUTCDay();
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  const tuesday = new Date(tsMs - daysSinceTuesday * 86_400_000);
  const yyyy = tuesday.getUTCFullYear();
  const mm = String(tuesday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(tuesday.getUTCDate()).padStart(2, "0");
  const start = `${yyyy}-${mm}-${dd}`;
  return { start, end: addDays(start, 7) };
}

function computeVisitWindow(
  firstStart: string,
  firstEnd: string,
  visitIndex: number,
  cadenceValue: number | null,
  cadenceUnit: "day" | "orbit" | null,
): { start: string; end: string } {
  if (visitIndex === 0) return { start: firstStart, end: firstEnd };
  const endStr = firstEnd || addDays(firstStart, 7);
  const midMs =
    (new Date(`${firstStart}T00:00:00Z`).getTime() +
      new Date(`${endStr}T00:00:00Z`).getTime()) /
    2;
  const cadenceMs =
    cadenceValue && cadenceUnit
      ? cadenceUnit === "orbit"
        ? cadenceValue * 97 * 60 * 1000
        : cadenceValue * 86_400_000
      : 0;
  return getTuesdayWindowForMs(midMs + visitIndex * cadenceMs);
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
    const totalExp = singleExp !== null ? singleExp * numberOfGpVisits : null;

    const defaultWindow = getDefaultTuesdayWindow();
    const firstStart = explicitStart ?? defaultWindow.start;
    const firstEnd = explicitEnd ?? addDays(firstStart, 7);

    let inserted: typeof tooToGpSchedule.$inferSelect[] | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [latestPlan] = await db
        .select({
          sequenceNo: tooToGpSchedule.sequenceNo,
        })
        .from(tooToGpSchedule)
        .where(eq(tooToGpSchedule.approvedTooId, numId))
        .orderBy(desc(tooToGpSchedule.sequenceNo), desc(tooToGpSchedule.id))
        .limit(1);

      const sequenceNoBase = (latestPlan?.sequenceNo ?? 0) + 1;
      const insertValues = Array.from({ length: numberOfGpVisits }, (_, i) => {
        const seqNo = sequenceNoBase + i;
        const window = computeVisitWindow(firstStart, firstEnd, i, cadenceValue, cadenceUnit);
        return {
          approvedTooId: numId,
          operatorName: operator?.name ?? session?.username ?? null,
          parentEpDbObjectId,
          generatedEpDbObjectId: buildGeneratedId(parentEpDbObjectId, seqNo),
          sequenceNo: seqNo,
          earliestStartTime: window.start,
          plannedStartTime: window.start,
          plannedEndTime: window.end,
          cadenceValue,
          cadenceUnit,
          reviewedNumberOfVisitsSnapshot: numberOfGpVisits,
          reviewedSingleExposureTimeSnapshot: singleExp,
          reviewedTotalExposureTimeSnapshot: totalExp,
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