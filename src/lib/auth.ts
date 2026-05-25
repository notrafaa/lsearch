import { cookies } from "next/headers";

const cookieName = "lsearch_session";

function secret() {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(username: string) {
  const payload = base64UrlEncode(
    JSON.stringify({
      username,
      exp: Date.now() + 1000 * 60 * 60 * 12
    })
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifySession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload)) !== signature) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      username: string;
      exp: number;
    };
    if (!parsed.username || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function currentUser() {
  return verifySession(cookies().get(cookieName)?.value);
}

export function setSessionCookie(token: string) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export function clearSessionCookie() {
  cookies().delete(cookieName);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    return Response.json({ message: "Non authentifie" }, { status: 401 });
  }
  return user;
}
