import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermSchedulerJobs } from "@/src/db/schema";
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
    if (!sessionId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [runningJob] = await db
      .select()
      .from(shortTermSchedulerJobs)
      .where(and(
        eq(shortTermSchedulerJobs.sessionId, sessionId),
        inArray(shortTermSchedulerJobs.status, ["starting", "running", "cancelling"]),
      ))
      .orderBy(desc(shortTermSchedulerJobs.createdAt))
      .limit(1);

    if (!runningJob) {
      return NextResponse.json({ error: "No active scheduler job" }, { status: 404 });
    }

    const [job] = await db
      .update(shortTermSchedulerJobs)
      .set({
        cancelRequested: true,
        status: "cancelling",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shortTermSchedulerJobs.id, runningJob.id))
      .returning();

    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request scheduler cancellation" },
      { status: 500 },
    );
  }
}
