import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    category: { name: "Categories", slug: "category", hierarchical: true, rest_base: "categories" },
    post_tag: { name: "Tags", slug: "post_tag", hierarchical: false, rest_base: "tags" },
  });
}
