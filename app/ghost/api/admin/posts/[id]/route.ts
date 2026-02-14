import { NextRequest } from "next/server";
import { verifyGhostAuth, ghostError, getSiteUrl } from "@/lib/ghost";
import { getAllPosts } from "@/lib/blog";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";

// GET — read single post
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyGhostAuth(req)) return ghostError("Unauthorized", 401);

  const { id } = await params;
  const posts = getAllPosts();
  const post = posts.find((p) => p.slug === id);
  if (!post) return ghostError("Post not found", 404);

  const url = getSiteUrl();
  return Response.json({
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
        url: `${url}/blog/${post.slug}`,
        authors: [{ id: "1", name: "Andy", slug: "andy" }],
        tags: [],
        primary_author: { id: "1", name: "Andy", slug: "andy" },
        primary_tag: null,
      },
    ],
  });
}

// PUT — update post
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyGhostAuth(req)) return ghostError("Unauthorized", 401);

  const { id } = await params;
  const posts = getAllPosts();
  const existing = posts.find((p) => p.slug === id);
  if (!existing) return ghostError("Post not found", 404);

  try {
    const body = await req.json();
    const update = body.posts?.[0];
    if (!update) return ghostError("Missing post data", 422);

    const title = update.title || existing.title;
    let content = update.html || update.plaintext || existing.content;

    // Strip HTML for markdown
    let markdown = content;
    if (markdown.includes("<p>") || markdown.includes("<br")) {
      markdown = markdown
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${existing.date}"
description: "${(update.custom_excerpt || existing.description || "").replace(/"/g, '\\"')}"
---

${markdown.trim()}
`;

    const path = `content/blog/${id}.md`;
    const commitBody: Record<string, string> = {
      message: `blog: ${title}`,
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

    const url = getSiteUrl();
    const now = new Date().toISOString();
    return Response.json({
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
          created_at: existing.date,
          updated_at: now,
          published_at: existing.date,
          custom_excerpt: update.custom_excerpt || existing.description || null,
          url: `${url}/blog/${id}`,
          authors: [{ id: "1", name: "Andy", slug: "andy" }],
          tags: [],
          primary_author: { id: "1", name: "Andy", slug: "andy" },
          primary_tag: null,
        },
      ],
    });
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
