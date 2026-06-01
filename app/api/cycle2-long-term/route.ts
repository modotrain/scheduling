import { asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { getCycleTables } from "@/src/db/cycle-tables";
import { resolveCycleFromRequest } from "@/app/lib/cycles";

export async function GET(request: Request) {
  try {
    const cycle = resolveCycleFromRequest(request);
    const longTermObservationListCycle2 = getCycleTables(cycle).longTerm;
    const rows = await db
      .select()
      .from(longTermObservationListCycle2)
      .orderBy(
        sql`NULLIF(${longTermObservationListCycle2.weekId}, '')::int ASC NULLS LAST`,
        asc(longTermObservationListCycle2.sourceName),
        asc(longTermObservationListCycle2.id),
      );

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch cycle2 long-term rows" },
      { status: 500 },
    );
  }
}
