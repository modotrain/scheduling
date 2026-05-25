import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import {
  longTermObservationListCycle2,
  longTermObservationListCycle2GF,
  shortTermPlanSessions,
} from "@/src/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

function toSeconds(value: string | null, unit: string | null): number {
  const v = parseFloat(value ?? "0");
  if (!v || isNaN(v)) return 0;
  switch (unit?.toLowerCase()) {
    case "ks": return Math.round(v * 1000);
    case "hr": return Math.round(v * 3600);
    default: return Math.round(v);
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "cycle2";

    const [planSession] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!planSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const excludedIds = new Set<number>(
      type === "gf" ? planSession.excludedGfIds : planSession.excludedCycle2Ids,
    );

    if (type === "gf") {
      const rows = await db
        .select()
        .from(longTermObservationListCycle2GF)
        .where(eq(longTermObservationListCycle2GF.weekId, planSession.weekId));

      const enriched = rows.map((r) => ({
        ...r,
        sourceType: "gf" as const,
        isExcluded: excludedIds.has(r.id),
      }));

      const included = enriched.filter((r) => !r.isExcluded);
      const totalExposureS = included.reduce(
        (sum, r) => sum + toSeconds(r.totalExposureTimeAll ?? r.totalExposureTime, r.exposureTimeUnit),
        0,
      );

      return NextResponse.json({
        rows: enriched,
        stats: { count: included.length, totalCount: enriched.length, totalExposureS },
      });
    } else {
      const rows = await db
        .select()
        .from(longTermObservationListCycle2)
        .where(eq(longTermObservationListCycle2.weekId, planSession.weekId));

      const enriched = rows.map((r) => ({
        ...r,
        sourceType: "cycle2" as const,
        isExcluded: excludedIds.has(r.id),
      }));

      const included = enriched.filter((r) => !r.isExcluded);
      const totalExposureS = included.reduce(
        (sum, r) => sum + toSeconds(r.totalExposureTimeAll ?? r.totalExposureTime, r.exposureTimeUnit),
        0,
      );

      return NextResponse.json({
        rows: enriched,
        stats: { count: included.length, totalCount: enriched.length, totalExposureS },
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sources" },
      { status: 500 },
    );
  }
}
