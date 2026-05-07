import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    return NextResponse.json({
      authenticated: Boolean(session),
      vip: session?.vip ?? false,
      username: session?.username ?? null,
    });
  } catch {
    return NextResponse.json({ authenticated: false, vip: false, username: null }, { status: 200 });
  }
}
