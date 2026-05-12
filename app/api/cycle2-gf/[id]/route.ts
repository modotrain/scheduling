import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { cycle2GF } from "@/src/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const [row] = await db.select().from(cycle2GF).where(eq(cycle2GF.id, numId));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, string | null>;
    const [updated] = await db
      .update(cycle2GF)
      .set(body)
      .where(eq(cycle2GF.id, numId))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ row: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const [deleted] = await db
      .delete(cycle2GF)
      .where(eq(cycle2GF.id, numId))
      .returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 },
    );
  }
}
