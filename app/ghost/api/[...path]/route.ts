import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Catch-all: log what Ghost clients are requesting
export async function GET(req: NextRequest) {
  console.log("GHOST CATCH-ALL GET:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404 });
}

export async function POST(req: NextRequest) {
  console.log("GHOST CATCH-ALL POST:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404 });
}

export async function PUT(req: NextRequest) {
  console.log("GHOST CATCH-ALL PUT:", req.nextUrl.pathname);
  return Response.json({
    errors: [{ message: `Unknown endpoint: ${req.nextUrl.pathname}`, type: "NotFoundError" }],
  }, { status: 404 });
}
