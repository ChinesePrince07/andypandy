import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { savePost, deletePost, getRawPost } from "@/lib/blog";

// PUT — edit post
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
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

  await savePost(slug, fileContent);
  revalidateTag("posts");
  return Response.json({ ok: true });
}

// PATCH — toggle pin only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
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
  revalidateTag("posts");
  return Response.json({ ok: true });
}

// DELETE — delete post
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  await deletePost(slug);
  revalidateTag("posts");
  return Response.json({ ok: true });
}
