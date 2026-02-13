import { NextRequest, NextResponse } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;

// Minimal XML-RPC responder — enough for iA Writer to verify the connection
export async function POST(req: NextRequest) {
  const body = await req.text();

  // wp.getUsersBlogs — iA Writer calls this to verify credentials
  if (body.includes("wp.getUsersBlogs")) {
    const passwordMatch = body.match(/<string>([^<]+)<\/string>/g);
    const password = passwordMatch?.[1]?.replace(/<\/?string>/g, "") || "";

    if (password !== PUBLISH_SECRET) {
      return new NextResponse(
        `<?xml version="1.0"?>
<methodResponse><fault><value><struct>
<member><name>faultCode</name><value><int>403</int></value></member>
<member><name>faultString</name><value><string>Incorrect password.</string></value></member>
</struct></value></fault></methodResponse>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const siteUrl = process.env.SITE_URL || "https://personal-site-andy-zhangs-projects.vercel.app";
    return new NextResponse(
      `<?xml version="1.0"?>
<methodResponse><params><param><value><array><data><value><struct>
<member><name>isAdmin</name><value><boolean>1</boolean></value></member>
<member><name>url</name><value><string>${siteUrl}</string></value></member>
<member><name>blogid</name><value><string>1</string></value></member>
<member><name>blogName</name><value><string>Andy</string></value></member>
<member><name>xmlrpc</name><value><string>${siteUrl}/xmlrpc.php</string></value></member>
</struct></value></data></array></value></param></params></methodResponse>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // wp.newPost / metaWeblog.newPost — create a post
  if (body.includes("wp.newPost") || body.includes("metaWeblog.newPost")) {
    const titleMatch = body.match(/<name>title<\/name>\s*<value>(?:<string>)?([^<]+)/);
    const contentMatch = body.match(/<name>description<\/name>\s*<value>(?:<string>)?([^<]+)/) ||
      body.match(/<name>post_content<\/name>\s*<value>(?:<string>)?([^<]+)/);

    const title = titleMatch?.[1] || "Untitled";
    const content = contentMatch?.[1] || "";
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const date = new Date().toISOString().split("T")[0];

    const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: ""
---

${content}
`;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
    const REPO = "ChinesePrince07/personal-site";
    const path = `content/blog/${slug}.md`;
    const commitBody: Record<string, string> = {
      message: `blog: ${title}`,
      content: btoa(unescape(encodeURIComponent(markdown))),
    };

    const existing = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "personal-site" } }
    );
    if (existing.ok) {
      const data = await existing.json();
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

    if (!res.ok) {
      return new NextResponse(
        `<?xml version="1.0"?>
<methodResponse><fault><value><struct>
<member><name>faultCode</name><value><int>500</int></value></member>
<member><name>faultString</name><value><string>Failed to publish</string></value></member>
</struct></value></fault></methodResponse>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    return new NextResponse(
      `<?xml version="1.0"?>
<methodResponse><params><param><value><string>${Date.now()}</string></value></param></params></methodResponse>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Default: list supported methods
  return new NextResponse(
    `<?xml version="1.0"?>
<methodResponse><params><param><value><array><data>
<value><string>wp.getUsersBlogs</string></value>
<value><string>wp.newPost</string></value>
<value><string>metaWeblog.newPost</string></value>
</data></array></value></param></params></methodResponse>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
