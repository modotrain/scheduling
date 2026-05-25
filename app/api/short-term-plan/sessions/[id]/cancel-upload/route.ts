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

export async function POST(_request: Request, { params }: RouteParams) {
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

    // Revert all week_id changes
    for (const change of planSession.weekIdChanges) {
      if (change.table === "gf") {
        await db
          .update(longTermObservationListCycle2GF)
          .set({ weekId: change.oldWeekId, updatedAt: sql`now()` })
          .where(eq(longTermObservationListCycle2GF.id, change.rowId));
      } else {
        await db
          .update(longTermObservationListCycle2)
          .set({ weekId: change.oldWeekId, updatedAt: sql`now()` })
          .where(eq(longTermObservationListCycle2.id, change.rowId));
      }
    }

    // Reset session to confirmed state
    await db
      .update(shortTermPlanSessions)
      .set({
        uploadedObsPlanText: null,
        unscheduledEpDbIds: [],
        weekIdChanges: [],
        status: "confirmed",
        updatedAt: sql`now()`,
      })
      .where(eq(shortTermPlanSessions.id, sessionId));

    return NextResponse.json({ ok: true, revertedCount: planSession.weekIdChanges.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel upload" },
      { status: 500 },
    );
  }
}
