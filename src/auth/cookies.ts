type CookieSecurityMode = "auto" | "true" | "false";

function getCookieSecurityMode(): CookieSecurityMode {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true") {
    return "true";
  }
  if (raw === "false") {
    return "false";
  }
  return "auto";
}

export function shouldUseSecureAuthCookie(request: Request) {
  const mode = getCookieSecurityMode();

  if (mode === "true") {
    return true;
  }

  if (mode === "false") {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim() === "https";
  }

  return new URL(request.url).protocol === "https:";
}