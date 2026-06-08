import { NextRequest } from "next/server";
import {
  verifyPassword,
  createSession,
  COOKIE_NAME,
  SESSION_DAYS,
} from "@/lib/admin-auth";

// POST — login
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!verifyPassword(password)) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await createSession();
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return res;
}

// DELETE — logout
export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`
  );
  return res;
}
