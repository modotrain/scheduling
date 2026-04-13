import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/src/db/client";
import { usersTable } from "@/src/db/schema";

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

function validateUserPayload(payload: UserPayload): UserValidationResult {
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

export async function GET() {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.id));
    return NextResponse.json({ users });
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

    const [createdUser] = await db
      .insert(usersTable)
      .values(validation.data)
      .returning();

    return NextResponse.json({ user: createdUser }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
