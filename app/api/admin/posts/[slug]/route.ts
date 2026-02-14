import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import matter from "gray-matter";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";

async function getFileData(path: string): Promise<{ sha: string; raw: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "personal-site",
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { sha: data.sha, raw: Buffer.from(data.content, "base64").toString("utf8") };
}

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
  const path = `content/blog/${slug}.md`;

  const pinnedLine = pinned ? "\npinned: true" : "";
  const fileContent = `---
title: "${(title || "").replace(/"/g, '\\"')}"
date: "${date || new Date().toISOString().split("T")[0]}"
description: "${(description || "").replace(/"/g, '\\"')}"${pinnedLine}
---

${(content || "").trim()}
`;

  const fileData = await getFileData(path);
  const body: Record<string, string> = {
    message: `blog: update ${title}`,
    content: Buffer.from(fileContent).toString("base64"),
  };
  if (fileData?.sha) body.sha = fileData.sha;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "personal-site",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 502 });
  }

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
  const path = `content/blog/${slug}.md`;

  const fileData = await getFileData(path);
  if (!fileData) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const { data, content } = matter(fileData.raw);
  if (pinned) {
    data.pinned = true;
  } else {
    delete data.pinned;
  }

  const frontmatter = Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : v}`)
    .join("\n");
  const newContent = `---\n${frontmatter}\n---\n\n${content.trim()}\n`;

  const body = {
    message: `blog: ${pinned ? "pin" : "unpin"} ${data.title || slug}`,
    content: Buffer.from(newContent).toString("base64"),
    sha: fileData.sha,
  };

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "personal-site",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 502 });
  }

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
  const path = `content/blog/${slug}.md`;
  const fileData = await getFileData(path);
  if (!fileData) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

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
        message: `blog: delete ${slug}`,
        sha: fileData.sha,
      }),
    }
  );

  if (!res.ok) {
    return Response.json({ error: "Failed to delete" }, { status: 502 });
  }

  revalidateTag("posts");
  return Response.json({ ok: true });
}
