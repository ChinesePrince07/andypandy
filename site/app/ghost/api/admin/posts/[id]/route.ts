import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllPosts, savePost, deletePost } from "@/lib/blog";
import { htmlToMarkdown } from "@/lib/html-to-md";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.SITE_URL ||
  "https://andypandy.org";

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
          authors: [{ id: "1", name: "Andy Zhang", slug: "andy" }],
          tags: [],
          primary_author: { id: "1", name: "Andy Zhang", slug: "andy" },
          primary_tag: null,
        },
      ],
    },
    { headers: GHOST_HEADERS }
  );
}

// PUT — update post
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

    const date =
      update.published_at?.split("T")[0] ||
      update.created_at?.split("T")[0] ||
      existing.date;

    let markdown = htmlToMarkdown(content);

    const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${(update.custom_excerpt || existing.description || "").replace(/"/g, '\\"')}"
---

${markdown.trim()}
`;

    await savePost(id, fileContent);
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
            authors: [{ id: "1", name: "Andy Zhang", slug: "andy" }],
            tags: [],
            primary_author: { id: "1", name: "Andy Zhang", slug: "andy" },
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

  try {
    await deletePost(id);
    revalidateTag("posts");
    return new Response(null, { status: 204, headers: GHOST_HEADERS });
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
