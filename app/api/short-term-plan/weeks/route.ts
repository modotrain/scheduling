import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { longTermObservationListCycle2, longTermObservationListCycle2GF } from "@/src/db/schema";

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

    // Sort numerically by week number (WK42 → 42)
    const parseWeekNum = (wid: string) => parseInt(wid.replace(/\D/g, ""), 10) || 0;
    const now = new Date();
    // Keep weeks that have data (include ~4 weeks from today)
    const sorted = [...weekMap.values()]
      .sort((a, b) => parseWeekNum(a.weekId) - parseWeekNum(b.weekId));

    // Return up to 8 upcoming weeks (start from closest week to today based on minStart)
    const upcoming = sorted
      .filter((w) => {
        if (!w.minStart) return true;
        const startDate = new Date(w.minStart);
        return startDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // include last week
      })
      .slice(0, 8);

    return NextResponse.json({ weeks: upcoming });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch weeks" },
      { status: 500 },
    );
  }
}
