import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const REPO = "ChinesePrince07/personal-site";
const SITE_URL = process.env.SITE_URL || "https://andypandy.org";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function verifyToken(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${PUBLISH_SECRET}`;
}

async function commitFile(path: string, content: string, message: string) {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString("base64"),
  };

  const existing = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
  );
  if (existing.ok) {
    const data = await existing.json();
    body.sha = data.sha;
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
    throw new Error(`GitHub API error: ${await res.text()}`);
  }
}

// Micropub query (GET) — iA Writer uses this to discover capabilities
export async function GET(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q");

  if (q === "config") {
    return NextResponse.json({
      "post-types": [{ type: "entry", name: "Blog Post" }],
    });
  }

  if (q === "syndicate-to") {
    return NextResponse.json({ "syndicate-to": [] });
  }

  return NextResponse.json({});
}

// Micropub create (POST) — handles both form-encoded and JSON
export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "";
  let content = "";
  let summary = "";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    const props = json.properties || {};
    title = Array.isArray(props.name) ? props.name[0] : props.name || "";
    content = Array.isArray(props.content)
      ? props.content[0]
      : props.content || "";
    summary = Array.isArray(props.summary)
      ? props.summary[0]
      : props.summary || "";
    // Handle content objects (e.g. { html: "..." })
    if (typeof content === "object" && content !== null) {
      content = (content as Record<string, string>).text ||
        (content as Record<string, string>).html || "";
    }
  } else {
    const form = await req.formData();
    title = (form.get("name") as string) || "";
    content = (form.get("content") as string) || "";
    summary = (form.get("summary") as string) || "";
  }

  if (!title && !content) {
    return NextResponse.json(
      { error: "name or content is required" },
      { status: 400 }
    );
  }

  if (!title) {
    // Generate title from first line of content
    title = content.split("\n")[0].replace(/^#*\s*/, "").slice(0, 60);
  }

  const slug = slugify(title);
  const date = new Date().toISOString().split("T")[0];

  const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: "${summary.replace(/"/g, '\\"')}"
---

${content}
`;

  const path = `content/blog/${slug}.md`;

  try {
    await commitFile(path, markdown, `blog: ${title}`);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 502 }
    );
  }

  // Micropub spec: return 201 with Location header
  return new NextResponse(null, {
    status: 201,
    headers: {
      Location: `${SITE_URL}/blog/${slug}`,
    },
  });
}
