import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(approvedToO).orderBy(desc(approvedToO.id));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<typeof approvedToO.$inferInsert>;
    const [inserted] = await db.insert(approvedToO).values(body).returning();
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 },
    );
  }
}
