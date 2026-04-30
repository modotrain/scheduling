const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const AUTH_COOKIE_NAME = "sch_session";

export type SessionPayload = {
  sub: number;
  username: string;
  vip: boolean;
  exp: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-only-auth-secret-change-me";
}

function bytesToBinary(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${pad}`);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(payload: SessionPayload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = await sign(body);
  if (expected !== signature) {
    return null;
  }

  try {
    const rawPayload = JSON.parse(decoder.decode(fromBase64Url(body))) as Partial<SessionPayload>;
    const payload: SessionPayload = {
      sub: Number(rawPayload.sub),
      username: String(rawPayload.username ?? ""),
      vip: Boolean(rawPayload.vip),
      exp: Number(rawPayload.exp),
    };
    if (!Number.isFinite(payload.sub) || !payload.username || !Number.isFinite(payload.exp)) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}