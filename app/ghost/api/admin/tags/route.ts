import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

export async function GET(req: NextRequest) {
  return Response.json(
    {
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
    },
    { headers: GHOST_HEADERS }
  );
}
