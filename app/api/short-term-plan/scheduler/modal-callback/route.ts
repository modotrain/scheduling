import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { shortTermSchedulerJobs } from "@/src/db/schema";

type CallbackEvent = "progress" | "best" | "heartbeat" | "completed" | "failed" | "cancelled";
type SchedulerMode = "unp-first" | "eff-first";

type CallbackBody = {
  jobId: number;
  event: CallbackEvent;
  completedRuns?: number;
  totalRuns?: number;
  iter?: number;
  unp?: number;
  eff?: number;
  bestCsvUrl?: string;
  errorMessage?: string;
  modalRunId?: string;
};

function betterCandidate(
  mode: SchedulerMode,
  currentUnp: number | null,
  currentEff: number | null,
  incomingUnp: number,
  incomingEff: number,
): boolean {
  if (mode === "eff-first") {
    if (currentEff == null) return true;
    if (incomingEff > currentEff) return true;
    if (incomingEff < currentEff) return false;
    if (currentUnp == null) return true;
    return incomingUnp < currentUnp;
  }

  if (currentUnp == null) return true;
  if (incomingUnp < currentUnp) return true;
  if (incomingUnp > currentUnp) return false;
  if (currentEff == null) return true;
  return incomingEff > currentEff;
}

export async function POST(request: Request) {
  try {
    const configuredToken = process.env.MODAL_SCHEDULER_TOKEN ?? "";
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (configuredToken && bearer !== configuredToken) {
      return NextResponse.json({ error: "Unauthorized callback" }, { status: 401 });
    }

    const body = (await request.json()) as CallbackBody;
    const jobId = Number(body.jobId);
    if (!jobId) return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });

    const [job] = await db
      .select()
      .from(shortTermSchedulerJobs)
      .where(eq(shortTermSchedulerJobs.id, jobId));

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const nowIso = new Date().toISOString();

    const nextCompleted = Number.isFinite(body.completedRuns) ? Math.max(job.completedRuns ?? 0, Number(body.completedRuns)) : (job.completedRuns ?? 0);
    const nextTotal = Number.isFinite(body.totalRuns) ? Math.max(job.totalRuns ?? 0, Number(body.totalRuns)) : (job.totalRuns ?? 0);

    const updateData: Record<string, unknown> = {
      completedRuns: nextCompleted,
      totalRuns: nextTotal,
      heartbeatAt: nowIso,
      updatedAt: nowIso,
    };

    const hasCandidate = Number.isFinite(body.unp) && Number.isFinite(body.eff);
    if (hasCandidate) {
      const incomingUnp = Number(body.unp);
      const incomingEff = Number(body.eff);
      const mode = (job.mode === "eff-first" ? "eff-first" : "unp-first") as SchedulerMode;
      if (betterCandidate(mode, job.bestUnp, job.bestEff, incomingUnp, incomingEff)) {
        updateData.bestUnp = incomingUnp;
        updateData.bestEff = incomingEff;
        if (Number.isFinite(body.iter)) updateData.bestIter = Number(body.iter);
        if (body.bestCsvUrl) updateData.bestCsvUrl = body.bestCsvUrl;
      }
    }

    if (body.modalRunId) updateData.modalRunId = body.modalRunId;

    if (body.event === "progress" || body.event === "best" || body.event === "heartbeat") {
      if (job.status === "pending" || job.status === "starting") {
        updateData.status = "running";
      }
    } else if (body.event === "completed") {
      updateData.status = job.cancelRequested ? "cancelled" : "succeeded";
      updateData.finishedAt = nowIso;
      updateData.completedRuns = nextTotal > 0 ? nextTotal : nextCompleted;
      if (body.bestCsvUrl) updateData.bestCsvUrl = body.bestCsvUrl;
    } else if (body.event === "failed") {
      updateData.status = "failed";
      updateData.errorMessage = body.errorMessage ?? "Scheduler failed";
      updateData.finishedAt = nowIso;
    } else if (body.event === "cancelled") {
      updateData.status = "cancelled";
      updateData.finishedAt = nowIso;
    }

    const [updated] = await db
      .update(shortTermSchedulerJobs)
      .set(updateData)
      .where(eq(shortTermSchedulerJobs.id, job.id))
      .returning();

    return NextResponse.json({
      ok: true,
      job: updated,
      cancelRequested: Boolean(updated.cancelRequested),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process callback" },
      { status: 500 },
    );
  }
}
