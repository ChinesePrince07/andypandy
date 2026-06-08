import { NextRequest, NextResponse } from "next/server";
import { savePost } from "@/lib/blog";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${PUBLISH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, content } = await req.json();

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  const slug = slugify(title);
  const date = new Date().toISOString().split("T")[0];
  const desc = description || "";

  const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${desc.replace(/"/g, '\\"')}"
---

${content}
`;

  await savePost(slug, markdown);

  return NextResponse.json({ slug, url: `/blog/${slug}` });
}
