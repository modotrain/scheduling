import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { getCycleTables } from "@/src/db/cycle-tables";
import { resolveCycleFromRequest } from "@/app/lib/cycles";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const longTermObservationListCycle2 = getCycleTables(resolveCycleFromRequest(request)).longTerm;
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [row] = await db
      .select()
      .from(longTermObservationListCycle2)
      .where(eq(longTermObservationListCycle2.id, numId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch cycle2 long-term row" },
      { status: 500 },
    );
  }
}
