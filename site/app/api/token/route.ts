import { NextRequest, NextResponse } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;

// POST — exchange authorization code for access token
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let grant_type = "";
  let code = "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    grant_type = json.grant_type || "";
    code = json.code || "";
  } else {
    const form = await req.formData();
    grant_type = (form.get("grant_type") as string) || "";
    code = (form.get("code") as string) || "";
  }

  // For IndieAuth, just return the token if a code is provided
  // The auth endpoint already validated the secret
  if (code) {
    return NextResponse.json({
      access_token: PUBLISH_SECRET,
      token_type: "Bearer",
      scope: "create",
      me: process.env.SITE_URL || "https://andypandy.org",
    });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}

// GET — token verification
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${PUBLISH_SECRET}`) {
    return NextResponse.json({
      me: process.env.SITE_URL || "https://andypandy.org",
      scope: "create",
    });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
