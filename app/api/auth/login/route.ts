import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { shouldUseSecureAuthCookie } from "@/src/auth/cookies";
import { db } from "@/src/db/client";
import { loginLog } from "@/src/db/schema";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/src/auth/session";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;
    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const result = await db.execute(sql`
      SELECT id, username, name, email, vip
      FROM users
      WHERE username = ${username}
        AND password_hash <> ''
        AND password_hash = crypt(${password}, password_hash)
      LIMIT 1
    `);

    const rows = Array.isArray(result) ? result : result.rows;
    const user = rows[0] as
      | { id: number; username: string; name: string; email: string; vip: boolean }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createSessionToken({
      sub: Number(user.id),
      username: user.username,
      vip: Boolean(user.vip),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({
      user: {
        id: Number(user.id),
        username: user.username,
        name: user.name,
        email: user.email,
        vip: Boolean(user.vip),
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureAuthCookie(request),
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    // Record login — best-effort, must not block the login response
    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null;
      const ua = request.headers.get("user-agent");
      await db.insert(loginLog).values({
        userId: Number(user.id),
        username: user.username,
        ipAddress: ip,
        userAgent: ua ? ua.slice(0, 512) : null,
      });
    } catch {
      // silently ignore log errors
    }

    return response;
  } catch (error) {
    console.error("Failed to login", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}