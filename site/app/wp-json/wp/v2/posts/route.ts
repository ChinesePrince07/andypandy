import { NextRequest, NextResponse } from "next/server";
import { savePost } from "@/lib/blog";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL =
  process.env.SITE_URL || "https://andypandy.org";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// GET — list posts
export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json(
      { code: "rest_not_logged_in", message: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json([]);
}

// POST — create a new post
export async function POST(req: NextRequest) {
  try {
    if (!verifyAuth(req)) {
      return NextResponse.json(
        { code: "rest_not_logged_in", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const title =
      typeof body.title === "object" ? body.title.raw || body.title.rendered || "" : body.title || "";
    let content =
      typeof body.content === "object" ? body.content.raw || body.content.rendered || "" : body.content || "";
    const excerpt =
      typeof body.excerpt === "object" ? body.excerpt.raw || body.excerpt.rendered || "" : body.excerpt || "";

    if (!title && !content) {
      return NextResponse.json(
        { code: "rest_invalid_param", message: "title or content required" },
        { status: 400 }
      );
    }

    const postTitle = title || content.split("\n")[0].replace(/<[^>]*>/g, "").slice(0, 60);
    const slug = slugify(postTitle);
    const date = new Date().toISOString().split("T")[0];
    const description = stripHtml(excerpt);

    if (content.includes("<p>") || content.includes("<br")) {
      content = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    const markdown = `---
title: "${postTitle.replace(/"/g, '\\"')}"
date: "${date}"
description: "${description.replace(/"/g, '\\"')}"
---

${content.trim()}
`;

    await savePost(slug, markdown);

    const now = new Date().toISOString();
    const postResponse = {
      id: Date.now(),
      date: now,
      date_gmt: now,
      modified: now,
      modified_gmt: now,
      guid: { rendered: `${SITE_URL}/blog/${slug}`, raw: `${SITE_URL}/blog/${slug}` },
      slug,
      status: body.status || "publish",
      type: "post",
      link: `${SITE_URL}/blog/${slug}`,
      title: { raw: postTitle, rendered: postTitle },
      content: { raw: content, rendered: `<p>${content}</p>`, protected: false },
      excerpt: { raw: description, rendered: `<p>${description}</p>`, protected: false },
      author: 1,
      featured_media: 0,
      comment_status: "closed",
      ping_status: "closed",
      sticky: false,
      template: "",
      format: "standard",
      meta: {},
      categories: [],
      tags: [],
      permalink_template: `${SITE_URL}/blog/${slug}`,
      generated_slug: slug,
    };
    return NextResponse.json(postResponse, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { code: "internal_error", message: String(err) },
      { status: 500 }
    );
  }
}
