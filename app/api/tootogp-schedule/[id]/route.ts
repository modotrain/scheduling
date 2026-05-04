import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { tooToGpSchedule } from "@/src/db/schema";

type Params = { params: Promise<{ id: string }> };

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      plannedStartTime?: string | null;
      plannedEndTime?: string | null;
      notes?: string | null;
      status?: string | null;
    };

    const plannedStartTime = body.plannedStartTime === undefined ? undefined : toDateOnly(body.plannedStartTime);
    const plannedEndTime = body.plannedEndTime === undefined ? undefined : toDateOnly(body.plannedEndTime);

    if (body.plannedStartTime !== undefined && body.plannedStartTime !== null && !plannedStartTime) {
      return NextResponse.json({ error: "Invalid planned start date" }, { status: 400 });
    }
    if (body.plannedEndTime !== undefined && body.plannedEndTime !== null && !plannedEndTime) {
      return NextResponse.json({ error: "Invalid planned end date" }, { status: 400 });
    }

    const updatePayload: Partial<typeof tooToGpSchedule.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.plannedStartTime !== undefined) {
      updatePayload.plannedStartTime = plannedStartTime;
      updatePayload.earliestStartTime = plannedStartTime;
    }
    if (body.plannedEndTime !== undefined) {
      updatePayload.plannedEndTime = plannedEndTime;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes?.trim() ? body.notes.trim() : null;
    }
    if (body.status !== undefined && body.status !== null) {
      updatePayload.status = body.status;
    }

    const [updated] = await db
      .update(tooToGpSchedule)
      .set(updatePayload)
      .where(eq(tooToGpSchedule.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ row: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update GP planning record" },
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
      .delete(tooToGpSchedule)
      .where(eq(tooToGpSchedule.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete GP planning record" },
      { status: 500 },
    );
  }
}