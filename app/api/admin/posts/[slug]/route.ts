import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { savePost, deletePost, getRawPost } from "@/lib/blog";

function flushBlogCaches(slug: string) {
  revalidateTag("posts");
  revalidatePath("/blog");
  revalidatePath("/feed.xml");
  revalidatePath(`/blog/${slug}`);
}

export const dynamic = "force-dynamic";

// GET — load raw post (frontmatter + markdown body) for editing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const raw = await getRawPost(slug);
  if (!raw) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const fm = raw.frontmatter;
  return Response.json({
    slug,
    title: typeof fm.title === "string" ? fm.title : "",
    date: typeof fm.date === "string" ? fm.date : "",
    description: typeof fm.description === "string" ? fm.description : "",
    content: raw.content,
    pinned: fm.pinned === true,
  });
}

// PUT — edit post
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { title, date, description, content, pinned } = await req.json();

  const pinnedLine = pinned ? "\npinned: true" : "";
  const fileContent = `---
title: "${(title || "").replace(/"/g, '\\"')}"
date: "${date || new Date().toISOString().split("T")[0]}"
description: "${(description || "").replace(/"/g, '\\"')}"${pinnedLine}
---

${(content || "").trim()}
`;

  try {
    await savePost(slug, fileContent);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
  flushBlogCaches(slug);
  return Response.json({ ok: true });
}

// PATCH — toggle pin only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { pinned } = await req.json();

  const raw = await getRawPost(slug);
  if (!raw) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const data = raw.frontmatter;
  if (pinned) {
    data.pinned = true;
  } else {
    delete data.pinned;
  }

  const frontmatter = Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : v}`)
    .join("\n");
  const newContent = `---\n${frontmatter}\n---\n\n${raw.content.trim()}\n`;

  await savePost(slug, newContent);
  flushBlogCaches(slug);
  return Response.json({ ok: true });
}

// DELETE — delete post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  await deletePost(slug);
  flushBlogCaches(slug);
  return Response.json({ ok: true });
}
