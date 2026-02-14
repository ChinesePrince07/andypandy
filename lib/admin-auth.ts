import { cookies } from "next/headers";

const SECRET = process.env.ADMIN_PASSWORD || process.env.PUBLISH_SECRET || "";
const COOKIE_NAME = "admin_session";
const SESSION_DAYS = 7;

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
  return sig === expected;
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}

export function verifyPassword(password: string): boolean {
  return password === SECRET;
}

export { COOKIE_NAME, SESSION_DAYS };
