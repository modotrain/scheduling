import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermSchedulerJobs } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
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

    const [job] = await db
      .select()
      .from(shortTermSchedulerJobs)
      .where(eq(shortTermSchedulerJobs.sessionId, sessionId))
      .orderBy(desc(shortTermSchedulerJobs.createdAt))
      .limit(1);

    return NextResponse.json({ job: job ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch scheduler job" },
      { status: 500 },
    );
  }
}
