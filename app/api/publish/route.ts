import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const REPO = "ChinesePrince07/personal-site";

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

  const path = `content/blog/${slug}.md`;
  const body = {
    message: `blog: ${title}`,
    content: Buffer.from(markdown).toString("base64"),
  };

  // Check if file already exists (need its sha to update)
  const existing = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
  );
  if (existing.ok) {
    const data = await existing.json();
    (body as Record<string, string>).sha = data.sha;
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: "GitHub API error", details: err },
      { status: 502 }
    );
  }

  return NextResponse.json({ slug, url: `/blog/${slug}` });
}
