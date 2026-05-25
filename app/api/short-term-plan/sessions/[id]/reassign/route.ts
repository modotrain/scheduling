import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import {
  longTermObservationListCycle2,
  longTermObservationListCycle2GF,
  shortTermPlanSessions,
  type WeekIdChange,
} from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

type Assignment = {
  rowId: number;
  table: "cycle2" | "gf";
  newWeekId: string;
};

export async function POST(request: Request, { params }: RouteParams) {
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

    const body = (await request.json()) as { assignments: Assignment[] };
    if (!Array.isArray(body.assignments)) {
      return NextResponse.json({ error: "assignments array required" }, { status: 400 });
    }

    const changes: WeekIdChange[] = [];

    for (const assignment of body.assignments) {
      if (assignment.table === "gf") {
        const [row] = await db
          .select({ weekId: longTermObservationListCycle2GF.weekId })
          .from(longTermObservationListCycle2GF)
          .where(eq(longTermObservationListCycle2GF.id, assignment.rowId));

        if (row) {
          changes.push({ rowId: assignment.rowId, table: "gf", oldWeekId: row.weekId, newWeekId: assignment.newWeekId });
          await db
            .update(longTermObservationListCycle2GF)
            .set({ weekId: assignment.newWeekId, updatedAt: sql`now()` })
            .where(eq(longTermObservationListCycle2GF.id, assignment.rowId));
        }
      } else {
        const [row] = await db
          .select({ weekId: longTermObservationListCycle2.weekId })
          .from(longTermObservationListCycle2)
          .where(eq(longTermObservationListCycle2.id, assignment.rowId));

        if (row) {
          changes.push({ rowId: assignment.rowId, table: "cycle2", oldWeekId: row.weekId, newWeekId: assignment.newWeekId });
          await db
            .update(longTermObservationListCycle2)
            .set({ weekId: assignment.newWeekId, updatedAt: sql`now()` })
            .where(eq(longTermObservationListCycle2.id, assignment.rowId));
        }
      }
    }

    await db
      .update(shortTermPlanSessions)
      .set({
        weekIdChanges: changes,
        status: "completed",
        updatedAt: sql`now()`,
      })
      .where(eq(shortTermPlanSessions.id, sessionId));

    return NextResponse.json({ ok: true, changesCount: changes.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reassign" },
      { status: 500 },
    );
  }
}
