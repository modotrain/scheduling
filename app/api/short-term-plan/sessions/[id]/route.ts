import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermPlanSessions } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [row] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ session: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch session" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const body = (await request.json()) as Partial<{
      status: string;
      operatorName: string;
      excludedCycle2Ids: number[];
      excludedGfIds: number[];
      mergedCsvText: string;
    }>;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.operatorName !== undefined) updateData.operatorName = body.operatorName;
    if (body.excludedCycle2Ids !== undefined) updateData.excludedCycle2Ids = body.excludedCycle2Ids;
    if (body.excludedGfIds !== undefined) updateData.excludedGfIds = body.excludedGfIds;
    if (body.mergedCsvText !== undefined) updateData.mergedCsvText = body.mergedCsvText;

    const [updated] = await db
      .update(shortTermPlanSessions)
      .set(updateData)
      .where(eq(shortTermPlanSessions.id, sessionId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ session: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update session" },
      { status: 500 },
    );
  }
}
