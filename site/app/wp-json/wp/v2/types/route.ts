import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    post: {
      description: "Blog posts",
      hierarchical: false,
      name: "Posts",
      slug: "post",
      taxonomies: ["category", "post_tag"],
      rest_base: "posts",
      rest_namespace: "wp/v2",
    },
  });
}
