import { and, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermPlanSessions, shortTermSchedulerJobs } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

type SchedulerMode = "unp-first" | "eff-first";

function normalizeMode(input: unknown): SchedulerMode {
  return input === "eff-first" ? "eff-first" : "unp-first";
}

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

    const [session] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const [activeJob] = await db
      .select()
      .from(shortTermSchedulerJobs)
      .where(and(
        eq(shortTermSchedulerJobs.sessionId, sessionId),
        inArray(shortTermSchedulerJobs.status, ["starting", "running", "cancelling"]),
      ))
      .limit(1);

    if (activeJob) {
      return NextResponse.json(
        { error: "Scheduler is already running", job: activeJob },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<{
      mode: SchedulerMode;
      totalRuns: number;
      workers: number;
    }>;

    const mode = normalizeMode(body.mode);
    const totalRuns = Math.max(1, Math.min(200000, Number(body.totalRuns ?? 1000) || 1000));
    const workers = Math.max(1, Math.min(64, Number(body.workers ?? 4) || 4));

    const nowIso = new Date().toISOString();

    const [inserted] = await db
      .insert(shortTermSchedulerJobs)
      .values({
        sessionId,
        weekId: session.weekId,
        status: "starting",
        mode,
        totalRuns,
        workers,
        updatedAt: nowIso,
      })
      .returning();

    const modalStartUrl = process.env.MODAL_SCHEDULER_START_URL;
    const modalToken = process.env.MODAL_SCHEDULER_TOKEN;
    const appBaseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "";
    const callbackUrl = `${appBaseUrl.replace(/\/$/, "")}/api/short-term-plan/scheduler/modal-callback`;

    if (!modalStartUrl) {
      await db
        .update(shortTermSchedulerJobs)
        .set({
          status: "failed",
          errorMessage: "MODAL_SCHEDULER_START_URL is not configured",
          finishedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(eq(shortTermSchedulerJobs.id, inserted.id));

      return NextResponse.json(
        { error: "Scheduler backend is not configured" },
        { status: 500 },
      );
    }

    const modalResp = await fetch(modalStartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(modalToken ? { Authorization: `Bearer ${modalToken}` } : {}),
      },
      body: JSON.stringify({
        jobId: inserted.id,
        sessionId,
        weekId: session.weekId,
        mode,
        totalRuns,
        workers,
        callbackUrl,
      }),
    });

    const modalPayload = (await modalResp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!modalResp.ok) {
      const errMsg = String(modalPayload.error ?? `Modal start failed (${modalResp.status})`);
      await db
        .update(shortTermSchedulerJobs)
        .set({
          status: "failed",
          errorMessage: errMsg,
          finishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(shortTermSchedulerJobs.id, inserted.id));

      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const modalRunId =
      String(modalPayload.runId ?? modalPayload.callId ?? modalPayload.functionCallId ?? "").trim() || null;

    const [startedJob] = await db
      .update(shortTermSchedulerJobs)
      .set({
        status: "running",
        modalRunId,
        startedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shortTermSchedulerJobs.id, inserted.id))
      .returning();

    return NextResponse.json({ job: startedJob });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start scheduler" },
      { status: 500 },
    );
  }
}
