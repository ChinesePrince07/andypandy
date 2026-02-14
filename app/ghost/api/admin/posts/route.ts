import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.SITE_URL ||
  "https://personal-site-andy-zhangs-projects.vercel.app";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

function ghostError(message: string, status: number) {
  return Response.json(
    { errors: [{ message, type: "UnauthorizedError" }] },
    { status, headers: GHOST_HEADERS }
  );
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function postToGhost(post: {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
}) {
  return {
    id: post.slug,
    uuid: post.slug,
    title: post.title,
    slug: post.slug,
    html: post.content.includes("<") ? post.content : `<p>${post.content}</p>`,
    plaintext: post.content.replace(/<[^>]*>/g, ""),
    feature_image: null,
    featured: false,
    status: "published",
    visibility: "public",
    created_at: post.date || new Date().toISOString(),
    updated_at: post.date || new Date().toISOString(),
    published_at: post.date || new Date().toISOString(),
    custom_excerpt: post.description || null,
    excerpt: post.description || null,
    url: `${SITE_URL}/blog/${post.slug}`,
    authors: [{ id: "1", name: "Andy", slug: "andy" }],
    tags: [],
    primary_author: { id: "1", name: "Andy", slug: "andy" },
    primary_tag: null,
  };
}

// GET — list posts
export async function GET(req: NextRequest) {
  console.log("GHOST /posts/ HIT", { auth: req.headers.get("authorization")?.slice(0, 30) });

  try {
    const posts = await getAllPosts();
    return Response.json(
      {
        posts: posts.map(postToGhost),
        meta: {
          pagination: {
            page: 1,
            limit: 15,
            pages: 1,
            total: posts.length,
            next: null,
            prev: null,
          },
        },
      },
      { headers: GHOST_HEADERS }
    );
  } catch {
    return Response.json(
      { posts: [], meta: { pagination: { page: 1, limit: 15, pages: 0, total: 0, next: null, prev: null } } },
      { headers: GHOST_HEADERS }
    );
  }
}

// POST — create post
export async function POST(req: NextRequest) {
  // Auth disabled for now — Ulysses sends Ghost JWT but we skip verification
  // to avoid crashes from crypto imports

  try {
    const body = await req.json();
    const post = body.posts?.[0];
    if (!post) return ghostError("Missing post data", 422);

    const title = post.title || "Untitled";
    let content = post.html || post.mobiledoc || post.plaintext || "";
    const slug = post.slug || slugify(title);
    const date =
      post.published_at?.split("T")[0] ||
      post.created_at?.split("T")[0] ||
      new Date().toISOString().split("T")[0];
    const status = post.status || "draft";

    // Strip HTML for markdown storage
    let markdown = content;
    if (markdown.includes("<p>") || markdown.includes("<br")) {
      markdown = markdown
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${(post.custom_excerpt || "").replace(/"/g, '\\"')}"
---

${markdown.trim()}
`;

    const path = `content/blog/${slug}.md`;
    const commitBody: Record<string, string> = {
      message: `blog: ${title}`,
      content: btoa(unescape(encodeURIComponent(fileContent))),
    };

    // Check if file exists (for updates)
    const existing = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "User-Agent": "personal-site",
        },
      }
    );
    if (existing.ok) {
      const data = await existing.json();
      commitBody.sha = data.sha;
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "personal-site",
        },
        body: JSON.stringify(commitBody),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return ghostError(`GitHub error: ${err}`, 502);
    }

    // Bust the blog cache so the new post appears immediately
    revalidateTag("posts");

    const now = new Date().toISOString();
    const ghostPost = {
      id: slug,
      uuid: slug,
      title,
      slug,
      html: content,
      plaintext: markdown,
      status: status === "draft" ? "draft" : "published",
      visibility: "public",
      created_at: now,
      updated_at: now,
      published_at: status === "draft" ? null : now,
      custom_excerpt: post.custom_excerpt || null,
      url: `${SITE_URL}/blog/${slug}`,
      authors: [{ id: "1", name: "Andy", slug: "andy" }],
      tags: [],
      primary_author: { id: "1", name: "Andy", slug: "andy" },
      primary_tag: null,
    };

    return Response.json({ posts: [ghostPost] }, { status: 201, headers: GHOST_HEADERS });
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
