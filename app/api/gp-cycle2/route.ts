import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { gpCycle2 } from "@/src/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(gpCycle2).orderBy(desc(gpCycle2.id));
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
    const body = (await request.json()) as Record<string, string | null>;
    const [inserted] = await db.insert(gpCycle2).values(body).returning();
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 },
    );
  }
}
