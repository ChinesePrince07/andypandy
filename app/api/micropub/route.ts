import { NextRequest, NextResponse } from "next/server";
import { savePost } from "@/lib/blog";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL = process.env.SITE_URL || "https://andypandy.org";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function verifyToken(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${PUBLISH_SECRET}`;
}

// Micropub query (GET)
export async function GET(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q");

  if (q === "config") {
    return NextResponse.json({
      "post-types": [{ type: "entry", name: "Blog Post" }],
    });
  }

  if (q === "syndicate-to") {
    return NextResponse.json({ "syndicate-to": [] });
  }

  return NextResponse.json({});
}

// Micropub create (POST)
export async function POST(req: NextRequest) {
  try {
    if (!verifyToken(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let title = "";
    let content = "";
    let summary = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await req.json();
      const props = json.properties || {};
      title = Array.isArray(props.name) ? props.name[0] : props.name || "";
      content = Array.isArray(props.content)
        ? props.content[0]
        : props.content || "";
      summary = Array.isArray(props.summary)
        ? props.summary[0]
        : props.summary || "";
      if (typeof content === "object" && content !== null) {
        content = (content as Record<string, string>).text ||
          (content as Record<string, string>).html || "";
      }
    } else {
      const form = await req.formData();
      title = (form.get("name") as string) || "";
      content = (form.get("content") as string) || "";
      summary = (form.get("summary") as string) || "";
    }

    if (!title && !content) {
      return NextResponse.json(
        { error: "name or content is required" },
        { status: 400 }
      );
    }

    if (!title) {
      title = content.split("\n")[0].replace(/^#*\s*/, "").slice(0, 60);
    }

    const slug = slugify(title);
    const date = new Date().toISOString().split("T")[0];

    const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${summary.replace(/"/g, '\\"')}"
---

${content}
`;

    await savePost(slug, markdown);

    return new NextResponse(null, {
      status: 201,
      headers: { Location: `${SITE_URL}/blog/${slug}` },
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
