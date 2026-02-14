import { verifyGhostAuth, ghostError } from "@/lib/ghost";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!verifyGhostAuth(req)) return ghostError("Unauthorized", 401);

  return Response.json({
    tags: [],
    meta: {
      pagination: {
        page: 1,
        limit: 15,
        pages: 0,
        total: 0,
        next: null,
        prev: null,
      },
    },
  });
}
