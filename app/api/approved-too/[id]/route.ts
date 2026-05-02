import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { approvedToO } from "@/src/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [row] = await db.select().from(approvedToO).where(eq(approvedToO.id, numId));
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

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Partial<typeof approvedToO.$inferInsert>;
    const [updated] = await db
      .update(approvedToO)
      .set(body)
      .where(eq(approvedToO.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ row: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(approvedToO)
      .where(eq(approvedToO.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 },
    );
  }
}
