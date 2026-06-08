import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const origin = req.nextUrl.origin;

  // Discovery via HTTP Link headers
  res.headers.set(
    "Link",
    [
      `<${origin}/wp-json/>; rel="https://api.w.org/"`,
      `<${origin}/api/micropub>; rel="micropub"`,
      `<${origin}/api/auth>; rel="authorization_endpoint"`,
      `<${origin}/api/token>; rel="token_endpoint"`,
    ].join(", ")
  );

  return res;
}

export const config = {
  matcher: "/((?!_next|api|admin|wp-json|wp-admin|xmlrpc|ghost|favicon.ico).*)",
};
