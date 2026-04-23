import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { hashPassword } from "@/src/auth/password";
import { db } from "@/src/db/client";
import { usersTable } from "@/src/db/schema";

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
        password: string;
        vip: boolean;
      };
    };

function validateUserPayload(payload: UserPayload): UserValidationResult {
  const name = payload.name?.trim();
  const username = payload.username?.trim();
  const email = payload.email?.trim();
  const password = payload.password?.trim();

  if (!name || !username || !email || typeof payload.age !== "number" || Number.isNaN(payload.age)) {
    return { error: "name, username, email, and numeric age are required" };
  }

  if (!password) {
    return { error: "password is required" };
  }

  if (password.length < 8) {
    return { error: "password must be at least 8 characters" };
  }

  if (payload.age < 0) {
    return { error: "age must be zero or greater" };
  }

  return {
    data: {
      name,
      username,
      age: payload.age,
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

export async function GET() {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        age: usersTable.age,
        email: usersTable.email,
        vip: usersTable.vip,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.id));
    return NextResponse.json({ users: users.map(mapUser) });
  } catch (error) {
    console.error("Failed to fetch users", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UserPayload;
    const validation = validateUserPayload(body);

    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const passwordHash = await hashPassword(validation.data.password);

    const [createdUser] = await db
      .insert(usersTable)
      .values({
        name: validation.data.name,
        username: validation.data.username,
        age: validation.data.age,
        email: validation.data.email,
        passwordHash,
        vip: validation.data.vip,
      })
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        age: usersTable.age,
        email: usersTable.email,
        vip: usersTable.vip,
      });

    return NextResponse.json({ user: mapUser(createdUser) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
