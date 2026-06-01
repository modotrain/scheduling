import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { ACTIVE_CYCLE, getCycleEpoch } from "@/app/lib/cycles";
import { getCycleTables } from "@/src/db/cycle-tables";

function epochForActiveCycle(): string {
  return getCycleEpoch(ACTIVE_CYCLE) ?? "2025-08-12";
}

function getTuesdayWeekStart(date: Date): Date {
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, …
  const daysSinceTuesday = (dayOfWeek + 7 - 2) % 7;
  return new Date(date.getTime() - daysSinceTuesday * 86_400_000);
}

function getWeekLabel(date: Date): string {
  const tuesdayMs = getTuesdayWeekStart(date).getTime();
  const epochMs = new Date(`${epochForActiveCycle()}T00:00:00Z`).getTime();
  const weekNo = Math.floor((tuesdayMs - epochMs) / (7 * 86_400_000)) + 1;
  return `W${String(weekNo).padStart(2, "0")}`;
}

function parseWeekNum(wid: string): number {
  return parseInt(wid.replace(/\D/g, ""), 10) || 0;
}

export async function GET() {
  try {
    const cycleTables = getCycleTables(ACTIVE_CYCLE);
    const longTermCycle = cycleTables.longTerm;
    const longTermGf = cycleTables.longTermGf;

    // Query distinct weekIds with their date ranges from both tables
    const [cycle2Weeks, gfWeeks] = await Promise.all([
      db
        .select({
          weekId: longTermCycle.weekId,
          minStart: sql<string>`MIN(${longTermCycle.startTime})`,
          maxEnd: sql<string>`MAX(${longTermCycle.endTime})`,
        })
        .from(longTermCycle)
        .where(sql`${longTermCycle.weekId} IS NOT NULL AND ${longTermCycle.weekId} != ''`)
        .groupBy(longTermCycle.weekId),
      db
        .select({
          weekId: longTermGf.weekId,
          minStart: sql<string>`MIN(${longTermGf.startTime})`,
          maxEnd: sql<string>`MAX(${longTermGf.endTime})`,
        })
        .from(longTermGf)
        .where(sql`${longTermGf.weekId} IS NOT NULL AND ${longTermGf.weekId} != ''`)
        .groupBy(longTermGf.weekId),
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

    // Compute the NEXT week's label (start from next Tuesday, not current week)
    const currentWeekLabel = getWeekLabel(new Date());
    const currentWeekNum = parseWeekNum(currentWeekLabel);

    // Keep only weeks strictly after the current week (i.e., from next Tuesday onwards)
    const upcoming = [...weekMap.values()]
      .filter((w) => parseWeekNum(w.weekId) > currentWeekNum)
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
