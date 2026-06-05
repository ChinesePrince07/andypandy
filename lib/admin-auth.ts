import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const SECRET = process.env.ADMIN_PASSWORD || process.env.PUBLISH_SECRET || "";
const COOKIE_NAME = "admin_session";
const SESSION_DAYS = 7;

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function hmac(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmac(String(expires));
  return `${expires}.${sig}`;
}

export async function verifySession(token: string): Promise<boolean> {
  const [expiresStr, sig] = token.split(".");
  if (!expiresStr || !sig) return false;
  const expires = Number(expiresStr);
  if (Date.now() > expires) return false;
  const expected = await hmac(expiresStr);
  return timingSafeEqualStrings(sig, expected);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}

function bearerMatchesSecret(req: NextRequest | Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || SECRET === "") return false;
  if (auth.startsWith("Bearer ")) {
    return timingSafeEqualStrings(auth.slice(7), SECRET);
  }
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.split(":").slice(1).join(":");
      return timingSafeEqualStrings(password, SECRET);
    } catch {
      return false;
    }
  }
  return false;
}

export async function isAdminRequest(req: NextRequest | Request): Promise<boolean> {
  if (bearerMatchesSecret(req)) return true;
  return isAdmin();
}

export function verifyPassword(password: string): boolean {
  return password === SECRET;
}

export { COOKIE_NAME, SESSION_DAYS };
