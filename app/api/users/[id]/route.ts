import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { usersTable } from "@/src/db/schema";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type UserPayload = {
  name?: string;
  age?: number;
  email?: string;
  vip?: boolean;
};

type UserValidationResult =
  | { error: string }
  | {
      data: {
        name: string;
        age: number;
        email: string;
        vip: boolean;
      };
    };

async function parseUserId(context: RouteContext): Promise<number | null> {
  const params = await Promise.resolve(context.params);
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validateFullUserPayload(payload: UserPayload): UserValidationResult {
  const name = payload.name?.trim();
  const email = payload.email?.trim();

  if (!name || !email || typeof payload.age !== "number" || Number.isNaN(payload.age)) {
    return { error: "name, email, and numeric age are required" };
  }

  if (payload.age < 0) {
    return { error: "age must be zero or greater" };
  }

  return {
    data: {
      name,
      age: payload.age,
      email,
      vip: payload.vip ?? false,
    },
  };
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await parseUserId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UserPayload;
    const validation = validateFullUserPayload(body);

    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const values = validation.data;

    const [updatedUser] = await db
      .update(usersTable)
      .set(values)
      .where(eq(usersTable.id, id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Failed to update user", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await parseUserId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UserPayload;

    if (typeof body.vip !== "boolean") {
      return NextResponse.json({ error: "vip must be a boolean" }, { status: 400 });
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set({ vip: body.vip })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Failed to update vip status", error);
    return NextResponse.json({ error: "Failed to update vip status" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await parseUserId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const [deletedUser] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: deletedUser });
  } catch (error) {
    console.error("Failed to delete user", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
