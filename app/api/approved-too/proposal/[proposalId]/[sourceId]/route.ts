import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

type Params = { params: Promise<{ proposalId: string; sourceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { proposalId, sourceId } = await params;

  try {
    const [row] = await db
      .select()
      .from(approvedToO)
      .where(and(eq(approvedToO.proposalId, proposalId), eq(approvedToO.sourceId, sourceId)));
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}
