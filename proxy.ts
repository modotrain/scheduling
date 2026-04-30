import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/src/auth/session";

function buildLoginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (nextPath && nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  } else {
    url.searchParams.delete("next");
  }
  return url;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAuthApi = pathname.startsWith("/api/auth/");
  const isLoginPage = pathname === "/login";

  if (isAuthApi) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(buildLoginUrl(request));
  }

  if (pathname === "/users" && !session.vip) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};