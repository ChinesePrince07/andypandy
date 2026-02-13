import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const origin = req.nextUrl.origin;

  // IndieAuth/Micropub discovery via HTTP Link headers
  res.headers.set(
    "Link",
    [
      `<${origin}/api/micropub>; rel="micropub"`,
      `<${origin}/api/auth>; rel="authorization_endpoint"`,
      `<${origin}/api/token>; rel="token_endpoint"`,
    ].join(", ")
  );

  return res;
}

export const config = {
  matcher: "/((?!_next|api|favicon.ico).*)",
};
