import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { tooReqTable } from "@/src/db/schema";
import type { TooReqPayload } from "../route";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function parseId(context: RouteContext): Promise<number | null> {
  const params = await Promise.resolve(context.params);
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await parseId(context);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as TooReqPayload;
    const [updated] = await db
      .update(tooReqTable)
      .set(body)
      .where(eq(tooReqTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json({ row: updated });
  } catch (error) {
    console.error("Failed to update too_req", error);
    return NextResponse.json({ error: "Failed to update too_req" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await parseId(context);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { to_gp: boolean };
    if (typeof body.to_gp !== "boolean") {
      return NextResponse.json({ error: "to_gp must be a boolean" }, { status: 400 });
    }

    const [updated] = await db
      .update(tooReqTable)
      .set({ to_gp: body.to_gp })
      .where(eq(tooReqTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json({ row: updated });
  } catch (error) {
    console.error("Failed to toggle to_gp", error);
    return NextResponse.json({ error: "Failed to toggle to_gp" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await parseId(context);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(tooReqTable)
      .where(eq(tooReqTable.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json({ row: deleted });
  } catch (error) {
    console.error("Failed to delete too_req", error);
    return NextResponse.json({ error: "Failed to delete too_req" }, { status: 500 });
  }
}
