import crypto from "crypto";
import { NextRequest } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL =
  process.env.SITE_URL ||
  "https://andypandy.org";

// Derive a deterministic Ghost Admin API key from PUBLISH_SECRET
const ghostId = crypto
  .createHash("sha256")
  .update(PUBLISH_SECRET + ":ghost-id")
  .digest("hex")
  .slice(0, 24);

const ghostSecret = crypto
  .createHash("sha256")
  .update(PUBLISH_SECRET + ":ghost-secret")
  .digest("hex");

/** The full Admin API key in id:secret format (= Staff Access Token) */
export function getGhostAdminApiKey(): string {
  return `${ghostId}:${ghostSecret}`;
}

export function getGhostId(): string {
  return ghostId;
}

export function getSiteUrl(): string {
  return SITE_URL;
}

function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

/** Verify a Ghost JWT from the Authorization header */
export function verifyGhostAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Ghost ")) return false;

  const token = auth.slice(6);
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(headerB64).toString());
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString());

    // Verify kid matches our id
    if (header.kid !== ghostId) return false;
    // Verify algorithm
    if (header.alg !== "HS256") return false;
    // Verify audience
    if (payload.aud !== "/admin/") return false;

    // Verify not expired (with 30s tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now - 30) return false;

    // Verify HMAC-SHA256 signature
    const secretBytes = Buffer.from(ghostSecret, "hex");
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac("sha256", secretBytes)
      .update(data)
      .digest();
    const actualSig = base64UrlDecode(signatureB64);

    if (expectedSig.length !== actualSig.length) return false;
    return crypto.timingSafeEqual(expectedSig, actualSig);
  } catch {
    return false;
  }
}

/** Standard Ghost API error response */
export function ghostError(message: string, status: number) {
  return Response.json(
    { errors: [{ message, type: "UnauthorizedError" }] },
    { status }
  );
}
