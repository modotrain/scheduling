import { asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { longTermObservationListCycle2 } from "@/src/db/schema";

export async function GET() {
  try {
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
