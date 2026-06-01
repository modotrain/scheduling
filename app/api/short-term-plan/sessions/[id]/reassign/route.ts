import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACTIVE_CYCLE } from "@/app/lib/cycles";
import { db } from "@/src/db/client";
import { getCycleTables } from "@/src/db/cycle-tables";
import { shortTermPlanSessions, type WeekIdChange } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

type Assignment = {
  rowId: number;
  table: "cycle" | "cycle2" | "gf";
  newWeekId: string;
};

export async function POST(request: Request, { params }: RouteParams) {
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

    const body = (await request.json()) as { assignments: Assignment[] };
    if (!Array.isArray(body.assignments)) {
      return NextResponse.json({ error: "assignments array required" }, { status: 400 });
    }

    const changes: WeekIdChange[] = [];

    for (const assignment of body.assignments) {
      if (assignment.table === "gf") {
        const [row] = await db
          .select({ weekId: longTermGf.weekId })
          .from(longTermGf)
          .where(eq(longTermGf.id, assignment.rowId));

        if (row) {
          changes.push({ rowId: assignment.rowId, table: "gf", oldWeekId: row.weekId, newWeekId: assignment.newWeekId });
          await db
            .update(longTermGf)
            .set({ weekId: assignment.newWeekId, updatedAt: sql`now()` })
            .where(eq(longTermGf.id, assignment.rowId));
        }
      } else {
        const [row] = await db
          .select({ weekId: longTermCycle.weekId })
          .from(longTermCycle)
          .where(eq(longTermCycle.id, assignment.rowId));

        if (row) {
          changes.push({ rowId: assignment.rowId, table: "cycle", oldWeekId: row.weekId, newWeekId: assignment.newWeekId });
          await db
            .update(longTermCycle)
            .set({ weekId: assignment.newWeekId, updatedAt: sql`now()` })
            .where(eq(longTermCycle.id, assignment.rowId));
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
