import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { longTermObservationListCycle2, longTermObservationListCycle2GF } from "@/src/db/schema";

// Mirror of week-utils.ts — keeps API route self-contained (no client-only import)
const CYCLE2_EPOCH = "2025-08-12"; // Must stay in sync with app/lib/week-utils.ts

function getTuesdayWeekStart(date: Date): Date {
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, …
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  return new Date(date.getTime() - daysSinceTuesday * 86_400_000);
}

function getWeekLabel(date: Date): string {
  const tuesdayMs = getTuesdayWeekStart(date).getTime();
  const epochMs = new Date(`${CYCLE2_EPOCH}T00:00:00Z`).getTime();
  const weekNo = Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
  return `W${String(weekNo).padStart(2, "0")}`;
}

function parseWeekNum(wid: string): number {
  return parseInt(wid.replace(/\D/g, ""), 10) || 0;
}

export async function GET() {
  try {
    // Query distinct weekIds with their date ranges from both tables
    const [cycle2Weeks, gfWeeks] = await Promise.all([
      db
        .select({
          weekId: longTermObservationListCycle2.weekId,
          minStart: sql<string>`MIN(${longTermObservationListCycle2.startTime})`,
          maxEnd: sql<string>`MAX(${longTermObservationListCycle2.endTime})`,
        })
        .from(longTermObservationListCycle2)
        .where(sql`${longTermObservationListCycle2.weekId} IS NOT NULL AND ${longTermObservationListCycle2.weekId} != ''`)
        .groupBy(longTermObservationListCycle2.weekId),
      db
        .select({
          weekId: longTermObservationListCycle2GF.weekId,
          minStart: sql<string>`MIN(${longTermObservationListCycle2GF.startTime})`,
          maxEnd: sql<string>`MAX(${longTermObservationListCycle2GF.endTime})`,
        })
        .from(longTermObservationListCycle2GF)
        .where(sql`${longTermObservationListCycle2GF.weekId} IS NOT NULL AND ${longTermObservationListCycle2GF.weekId} != ''`)
        .groupBy(longTermObservationListCycle2GF.weekId),
    ]);

    // Merge and deduplicate by weekId
    const weekMap = new Map<string, { weekId: string; minStart: string | null; maxEnd: string | null }>();
    for (const row of [...cycle2Weeks, ...gfWeeks]) {
      if (!row.weekId) continue;
      const existing = weekMap.get(row.weekId);
      if (!existing) {
        weekMap.set(row.weekId, { weekId: row.weekId, minStart: row.minStart, maxEnd: row.maxEnd });
      } else {
        weekMap.set(row.weekId, {
          weekId: row.weekId,
          minStart: row.minStart && existing.minStart ? (row.minStart < existing.minStart ? row.minStart : existing.minStart) : (row.minStart ?? existing.minStart),
          maxEnd: row.maxEnd && existing.maxEnd ? (row.maxEnd > existing.maxEnd ? row.maxEnd : existing.maxEnd) : (row.maxEnd ?? existing.maxEnd),
        });
      }
    }

    // Compute current week label using the same Tuesday-epoch logic as week-utils.ts
    const currentWeekLabel = getWeekLabel(new Date());
    const currentWeekNum = parseWeekNum(currentWeekLabel);

    // Keep only weeks from the current week onwards, sorted numerically, up to 8
    const upcoming = [...weekMap.values()]
      .filter((w) => parseWeekNum(w.weekId) >= currentWeekNum)
      .sort((a, b) => parseWeekNum(a.weekId) - parseWeekNum(b.weekId))
      .slice(0, 8);

    return NextResponse.json({ weeks: upcoming });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch weeks" },
      { status: 500 },
    );
  }
}
