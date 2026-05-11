import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hashPassword } from "@/src/auth/password";
import { db } from "@/src/db/client";
import { usersTable } from "@/src/db/schema";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type UserPayload = {
  name?: string;
  username?: string;
  age?: number;
  email?: string;
  password?: string;
  vip?: boolean;
};

type UserValidationResult =
  | { error: string }
  | {
      data: {
        name: string;
        username: string;
        age: number;
        email: string;
        password?: string;
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
  const username = payload.username?.trim();
  const email = payload.email?.trim();
  const password = payload.password?.trim();
  const hasAge = typeof payload.age === "number" && !Number.isNaN(payload.age);

  if (!name || !username || !email) {
    return { error: "name, username, and email are required" };
  }

  if (password && password.length < 8) {
    return { error: "password must be at least 8 characters" };
  }

  if (hasAge && (payload.age as number) < 0) {
    return { error: "age must be zero or greater" };
  }

  return {
    data: {
      name,
      username,
      age: hasAge ? (payload.age as number) : 0,
      email,
      password,
      vip: payload.vip ?? false,
    },
  };
}

function mapUser(user: {
  id: number;
  name: string;
  username: string;
  age: number;
  email: string;
  vip: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    age: user.age,
    email: user.email,
    vip: user.vip,
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

    const values: {
      name: string;
      username: string;
      age?: number;
      email: string;
      vip: boolean;
      passwordHash?: string;
    } = {
      name: validation.data.name,
      username: validation.data.username,
      email: validation.data.email,
      vip: validation.data.vip,
    };

    if (typeof body.age === "number" && !Number.isNaN(body.age)) {
      values.age = validation.data.age;
    }

    if (validation.data.password) {
      values.passwordHash = await hashPassword(validation.data.password);
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set(values)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        age: usersTable.age,
        email: usersTable.email,
        vip: usersTable.vip,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: mapUser(updatedUser) });
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
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        age: usersTable.age,
        email: usersTable.email,
        vip: usersTable.vip,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: mapUser(updatedUser) });
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
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        age: usersTable.age,
        email: usersTable.email,
        vip: usersTable.vip,
      });

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: mapUser(deletedUser) });
  } catch (error) {
    console.error("Failed to delete user", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
