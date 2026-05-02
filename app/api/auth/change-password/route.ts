import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { hashPassword } from "@/src/auth/password";
import { db } from "@/src/db/client";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ChangePasswordPayload;
    const currentPassword = body.currentPassword?.trim();
    const newPassword = body.newPassword?.trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const checkResult = await db.execute(sql`
      SELECT id
      FROM users
      WHERE id = ${session.sub}
        AND password_hash <> ''
        AND password_hash = crypt(${currentPassword}, password_hash)
      LIMIT 1
    `);

    const checkRows = Array.isArray(checkResult) ? checkResult : checkResult.rows;
    if (!checkRows[0]) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);

    await db.execute(sql`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${session.sub}
    `);

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Failed to change password", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
