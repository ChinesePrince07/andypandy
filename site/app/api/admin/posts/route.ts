import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAllPosts, getRawPost, savePost } from "@/lib/blog";

function flushBlogCaches(slug?: string) {
  revalidateTag("posts");
  revalidatePath("/blog");
  revalidatePath("/feed.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

export const dynamic = "force-dynamic";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET — list all posts (raw metadata, no rendered HTML)
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await getAllPosts();
  return Response.json(
    posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      description: p.description,
      pinned: p.pinned ?? false,
    }))
  );
}

// POST — create a new post. Body: { title, date?, description?, content, pinned?, slug? }
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();

  if (!title && !content) {
    return Response.json({ error: "title or content required" }, { status: 400 });
  }

  // Always normalize through slugify so caller-supplied slugs can't path-traverse.
  let slug = slugify((body.slug ? String(body.slug) : (title || content.split("\n")[0])).trim());
  if (!slug) {
    return Response.json({ error: "Could not derive slug" }, { status: 400 });
  }

  if (await getRawPost(slug)) {
    return Response.json({ error: "Post with that slug already exists" }, { status: 409 });
  }

  const date = body.date || new Date().toISOString().split("T")[0];
  const description = body.description || "";
  const pinned = body.pinned === true;
  const pinnedLine = pinned ? "\npinned: true" : "";

  const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${description.replace(/"/g, '\\"')}"${pinnedLine}
---

${content}
`;

  try {
    await savePost(slug, fileContent);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }

  flushBlogCaches(slug);
  return Response.json({ slug, ok: true }, { status: 201 });
}
