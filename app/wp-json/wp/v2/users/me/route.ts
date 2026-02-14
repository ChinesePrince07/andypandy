import { NextRequest, NextResponse } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;

function verifyAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";

  if (auth.startsWith("Bearer ")) {
    return auth.slice(7) === PUBLISH_SECRET;
  }

  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.split(":").slice(1).join(":");
      return password === PUBLISH_SECRET;
    } catch {
      return false;
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json(
      { code: "rest_not_logged_in", message: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    id: 1,
    name: "Andy Zhang",
    slug: "andy",
    roles: ["administrator"],
    capabilities: {
      publish_posts: true,
      edit_posts: true,
      edit_published_posts: true,
    },
  });
}
