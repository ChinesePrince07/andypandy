import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

// Catch-all: log what Ghost clients are requesting
export async function GET(req: NextRequest) {
  console.log("GHOST CATCH-ALL GET:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404, headers: GHOST_HEADERS });
}

export async function POST(req: NextRequest) {
  console.log("GHOST CATCH-ALL POST:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404, headers: GHOST_HEADERS });
}

export async function PUT(req: NextRequest) {
  console.log("GHOST CATCH-ALL PUT:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404, headers: GHOST_HEADERS });
}
