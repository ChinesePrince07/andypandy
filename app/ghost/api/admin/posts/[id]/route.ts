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

// GET — read single post
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === id);
  if (!post) return ghostError("Post not found", 404);

  return Response.json(
    {
      posts: [
        {
          id: post.slug,
          uuid: post.slug,
          title: post.title,
          slug: post.slug,
          html: post.content.includes("<")
            ? post.content
            : `<p>${post.content}</p>`,
          plaintext: post.content.replace(/<[^>]*>/g, ""),
          status: "published",
          visibility: "public",
          created_at: post.date,
          updated_at: post.date,
          published_at: post.date,
          custom_excerpt: post.description || null,
          url: `${SITE_URL}/blog/${post.slug}`,
          authors: [{ id: "1", name: "Andy", slug: "andy" }],
          tags: [],
          primary_author: { id: "1", name: "Andy", slug: "andy" },
          primary_tag: null,
        },
      ],
    },
    { headers: GHOST_HEADERS }
  );
}

// PUT — update post (title, content, date, description)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const posts = await getAllPosts();
  const existing = posts.find((p) => p.slug === id);
  if (!existing) return ghostError("Post not found", 404);

  try {
    const body = await req.json();
    const update = body.posts?.[0];
    if (!update) return ghostError("Missing post data", 422);

    const title = update.title || existing.title;
    let content = update.html || update.plaintext || existing.content;

    // Allow date editing via published_at or created_at
    const date =
      update.published_at?.split("T")[0] ||
      update.created_at?.split("T")[0] ||
      existing.date;

    // Convert HTML to markdown
    let markdown = content;
    if (markdown.includes("<p>") || markdown.includes("<br") || markdown.includes("<img")) {
      markdown = markdown.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
      markdown = markdown.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, "![]($1)");
      markdown = markdown.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, "$1\n");
      markdown = markdown.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, "*$1*\n");
      markdown = markdown
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${(update.custom_excerpt || existing.description || "").replace(/"/g, '\\"')}"
---

${markdown.trim()}
`;

    const path = `content/blog/${id}.md`;
    const commitBody: Record<string, string> = {
      message: `blog: update ${title}`,
      content: btoa(unescape(encodeURIComponent(fileContent))),
    };

    const ghFile = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "User-Agent": "personal-site",
        },
      }
    );
    if (ghFile.ok) {
      const data = await ghFile.json();
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

    if (!res.ok) return ghostError("Failed to update", 502);

    revalidateTag("posts");

    const now = new Date().toISOString();
    return Response.json(
      {
        posts: [
          {
            id,
            uuid: id,
            title,
            slug: id,
            html: content,
            plaintext: markdown,
            status: update.status || "published",
            visibility: "public",
            created_at: date,
            updated_at: now,
            published_at: date,
            custom_excerpt: update.custom_excerpt || existing.description || null,
            url: `${SITE_URL}/blog/${id}`,
            authors: [{ id: "1", name: "Andy", slug: "andy" }],
            tags: [],
            primary_author: { id: "1", name: "Andy", slug: "andy" },
            primary_tag: null,
          },
        ],
      },
      { headers: GHOST_HEADERS }
    );
  } catch (err) {
    return ghostError(String(err), 500);
  }
}

// DELETE — delete post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = `content/blog/${id}.md`;

  try {
    // Get file SHA (required for deletion)
    const ghFile = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "User-Agent": "personal-site",
        },
      }
    );
    if (!ghFile.ok) return ghostError("Post not found", 404);
    const data = await ghFile.json();

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "personal-site",
        },
        body: JSON.stringify({
          message: `blog: delete ${id}`,
          sha: data.sha,
        }),
      }
    );

    if (!res.ok) return ghostError("Failed to delete", 502);

    revalidateTag("posts");

    return new Response(null, { status: 204, headers: GHOST_HEADERS });
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
