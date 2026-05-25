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

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
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

    const [planSession] = await db
      .select()
      .from(shortTermPlanSessions)
      .where(eq(shortTermPlanSessions.id, sessionId));

    if (!planSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Parse uploaded file from FormData
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const csvText = await (file as File).text();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV file appears empty" }, { status: 400 });
    }

    // Parse headers to find EP_DB_OBJECT_ID column index
    const headerLine = parseCsvLine(lines[0]);
    const epDbIdIndex = headerLine.findIndex((h) => h.trim() === "EP_DB_OBJECT_ID");
    if (epDbIdIndex === -1) {
      return NextResponse.json({ error: "EP_DB_OBJECT_ID column not found in uploaded file" }, { status: 400 });
    }

    // Collect all EP_DB_OBJECT_IDs from uploaded obs plan
    const scheduledEpIds = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const epId = cells[epDbIdIndex]?.trim();
      if (epId) scheduledEpIds.add(epId);
    }

    // Get the merged source list EP_DB_OBJECT_IDs (from non-excluded sources)
    const excludedCycle2 = new Set<number>(planSession.excludedCycle2Ids);
    const excludedGf = new Set<number>(planSession.excludedGfIds);

    const [cycle2Rows, gfRows] = await Promise.all([
      db.select({ id: longTermObservationListCycle2.id, epDbObjectId: longTermObservationListCycle2.epDbObjectId, sourceId: longTermObservationListCycle2.sourceId, sourceName: longTermObservationListCycle2.sourceName, obsType: longTermObservationListCycle2.obsType })
        .from(longTermObservationListCycle2)
        .where(eq(longTermObservationListCycle2.weekId, planSession.weekId)),
      db.select({ id: longTermObservationListCycle2GF.id, epDbObjectId: longTermObservationListCycle2GF.epDbObjectId, sourceId: longTermObservationListCycle2GF.sourceId, sourceName: longTermObservationListCycle2GF.sourceName, obsType: longTermObservationListCycle2GF.obsType })
        .from(longTermObservationListCycle2GF)
        .where(eq(longTermObservationListCycle2GF.weekId, planSession.weekId)),
    ]);

    const mergedSources = [
      ...cycle2Rows.filter((r) => !excludedCycle2.has(r.id)).map((r) => ({ ...r, table: "cycle2" as const })),
      ...gfRows.filter((r) => !excludedGf.has(r.id)).map((r) => ({ ...r, table: "gf" as const })),
    ];

    // Find unscheduled sources (in merged list but EP_DB_OBJECT_ID not in obs plan)
    const unscheduledSources = mergedSources.filter(
      (r) => !r.epDbObjectId || !scheduledEpIds.has(r.epDbObjectId),
    );
    const unscheduledEpDbIds = unscheduledSources
      .map((r) => r.epDbObjectId)
      .filter((id): id is string => Boolean(id));

    // Save to session
    await db
      .update(shortTermPlanSessions)
      .set({
        uploadedObsPlanText: csvText,
        unscheduledEpDbIds,
        status: "uploaded",
        updatedAt: sql`now()`,
      })
      .where(eq(shortTermPlanSessions.id, sessionId));

    return NextResponse.json({
      scheduledCount: scheduledEpIds.size,
      mergedCount: mergedSources.length,
      unscheduledCount: unscheduledSources.length,
      unscheduledSources: unscheduledSources.map((r) => ({
        rowId: r.id,
        table: r.table,
        sourceId: r.sourceId,
        epDbObjectId: r.epDbObjectId,
        sourceName: r.sourceName,
        obsType: r.obsType,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process upload" },
      { status: 500 },
    );
  }
}
