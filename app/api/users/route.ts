import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/src/db/client";
import { usersTable } from "@/src/db/schema";

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
    const body = await request.json();
    const { name, age, email } = body as {
      name?: string;
      age?: number;
      email?: string;
    };

    if (!name || !email || typeof age !== "number") {
      return NextResponse.json(
        { error: "name, email, and numeric age are required" },
        { status: 400 }
      );
    }

    const [createdUser] = await db
      .insert(usersTable)
      .values({ name, age, email })
      .returning();

    return NextResponse.json({ user: createdUser }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
