import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { id: 1, count: 0, description: "", link: "", name: "Uncategorized", slug: "uncategorized", taxonomy: "category", parent: 0 },
  ]);
}
