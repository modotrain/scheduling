import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermPlanSessions } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

export async function GET() {
  try {
    const sessions = await db
      .select({
        id: shortTermPlanSessions.id,
        weekId: shortTermPlanSessions.weekId,
        status: shortTermPlanSessions.status,
        operatorName: shortTermPlanSessions.operatorName,
        createdAt: shortTermPlanSessions.createdAt,
        updatedAt: shortTermPlanSessions.updatedAt,
      })
      .from(shortTermPlanSessions)
      .orderBy(desc(shortTermPlanSessions.createdAt));

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { weekId: string; operatorName?: string };
    if (!body.weekId) {
      return NextResponse.json({ error: "weekId is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(shortTermPlanSessions)
      .values({
        weekId: body.weekId,
        operatorName: body.operatorName ?? session.username ?? null,
        status: "active",
        excludedCycle2Ids: [],
        excludedGfIds: [],
        unscheduledEpDbIds: [],
        weekIdChanges: [],
      })
      .returning();

    return NextResponse.json({ session: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create session" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const authSession = token ? await verifySessionToken(token) : null;
    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") ?? "", 10);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.delete(shortTermPlanSessions).where(eq(shortTermPlanSessions.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete session" },
      { status: 500 },
    );
  }
}
