import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, savePost } from "@/lib/blog";
import { r2AbsoluteUrl, r2Put } from "@/lib/r2-storage";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL =
  process.env.SITE_URL || "https://andypandy.org";

function xml(body: string) {
  return new NextResponse(`<?xml version="1.0"?>\n${body}`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function fault(code: number, message: string) {
  return xml(
    `<methodResponse><fault><value><struct>
<member><name>faultCode</name><value><int>${code}</int></value></member>
<member><name>faultString</name><value><string>${message}</string></value></member>
</struct></value></fault></methodResponse>`
  );
}

function verifyAuth(body: string): boolean {
  const strings = [...body.matchAll(/<string>([^<]*)<\/string>/g)].map(
    (m) => m[1]
  );
  // Password is at index 1 for wp.getUsersBlogs(user, pass)
  // or index 2 for wp.*(blog_id, user, pass, ...) / metaWeblog.*(blog_id, user, pass, ...)
  return strings[1] === PUBLISH_SECRET || strings[2] === PUBLISH_SECRET;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function postToXmlRpc(post: {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
}) {
  const d = post.date || new Date().toISOString().split("T")[0];
  const iso = d.replace(/-/g, "") + "T00:00:00";
  return `<value><struct>
<member><name>post_id</name><value><string>${escXml(post.slug)}</string></value></member>
<member><name>post_title</name><value><string>${escXml(post.title)}</string></value></member>
<member><name>post_date</name><value><dateTime.iso8601>${iso}</dateTime.iso8601></value></member>
<member><name>post_date_gmt</name><value><dateTime.iso8601>${iso}</dateTime.iso8601></value></member>
<member><name>post_status</name><value><string>publish</string></value></member>
<member><name>post_type</name><value><string>post</string></value></member>
<member><name>post_content</name><value><string>${escXml(post.content)}</string></value></member>
<member><name>post_excerpt</name><value><string>${escXml(post.description)}</string></value></member>
<member><name>post_name</name><value><string>${escXml(post.slug)}</string></value></member>
<member><name>link</name><value><string>${SITE_URL}/blog/${post.slug}</string></value></member>
<member><name>terms</name><value><array><data></data></array></value></member>
<member><name>custom_fields</name><value><array><data></data></array></value></member>
</struct></value>`;
}

async function saveBlogPost(slug: string, content: string): Promise<boolean> {
  try {
    await savePost(slug, content);
    return true;
  } catch {
    return false;
  }
}

function getMethod(body: string): string {
  const match = body.match(/<methodName>([^<]+)<\/methodName>/);
  return match?.[1] || "";
}

// GET — RSD discovery
export async function GET(req: NextRequest) {
  const rsd = req.nextUrl.searchParams.has("rsd");
  if (rsd) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<rsd version="1.0" xmlns="http://archipelago.phrasewise.com/rsd">
  <service>
    <engineName>WordPress</engineName>
    <engineLink>https://wordpress.org/</engineLink>
    <homePageLink>${SITE_URL}</homePageLink>
    <apis>
      <api name="WordPress" blogID="1" preferred="true" apiLink="${SITE_URL}/xmlrpc.php" />
      <api name="MetaWeblog" blogID="1" preferred="false" apiLink="${SITE_URL}/xmlrpc.php" />
    </apis>
  </service>
</rsd>`,
      { headers: { "Content-Type": "application/rsd+xml" } }
    );
  }

  return new NextResponse("XML-RPC server accepts POST requests only.", {
    status: 405,
  });
}

// POST — XML-RPC handler
export async function POST(req: NextRequest) {
  const body = await req.text();
  const method = getMethod(body);

  // --- system.listMethods ---
  if (method === "system.listMethods") {
    const methods = [
      "system.listMethods",
      "wp.getUsersBlogs",
      "wp.getPosts",
      "wp.getPost",
      "wp.newPost",
      "wp.editPost",
      "wp.getOptions",
      "wp.getCategories",
      "wp.getTerms",
      "metaWeblog.newPost",
      "metaWeblog.editPost",
      "metaWeblog.getPost",
      "metaWeblog.getRecentPosts",
      "metaWeblog.newMediaObject",
    ];
    return xml(
      `<methodResponse><params><param><value><array><data>
${methods.map((m) => `<value><string>${m}</string></value>`).join("\n")}
</data></array></value></param></params></methodResponse>`
    );
  }

  // --- wp.getUsersBlogs ---
  if (method === "wp.getUsersBlogs") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");
    return xml(
      `<methodResponse><params><param><value><array><data><value><struct>
<member><name>isAdmin</name><value><boolean>1</boolean></value></member>
<member><name>url</name><value><string>${SITE_URL}</string></value></member>
<member><name>blogid</name><value><string>1</string></value></member>
<member><name>blogName</name><value><string>Andy</string></value></member>
<member><name>xmlrpc</name><value><string>${SITE_URL}/xmlrpc.php</string></value></member>
</struct></value></data></array></value></param></params></methodResponse>`
    );
  }

  // --- wp.getOptions ---
  if (method === "wp.getOptions") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");
    return xml(
      `<methodResponse><params><param><value><struct>
<member><name>software_name</name><value><struct>
  <member><name>value</name><value><string>WordPress</string></value></member>
</struct></value></member>
<member><name>software_version</name><value><struct>
  <member><name>value</name><value><string>6.4</string></value></member>
</struct></value></member>
<member><name>blog_url</name><value><struct>
  <member><name>value</name><value><string>${SITE_URL}</string></value></member>
</struct></value></member>
<member><name>blog_title</name><value><struct>
  <member><name>value</name><value><string>Andy</string></value></member>
</struct></value></member>
<member><name>blog_tagline</name><value><struct>
  <member><name>value</name><value><string>Personal site &amp; blog</string></value></member>
</struct></value></member>
</struct></value></param></params></methodResponse>`
    );
  }

  // --- wp.getCategories / wp.getTerms ---
  if (
    method === "wp.getCategories" ||
    method === "wp.getTerms"
  ) {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");
    return xml(
      `<methodResponse><params><param><value><array><data>
<value><struct>
<member><name>categoryId</name><value><string>1</string></value></member>
<member><name>categoryName</name><value><string>Uncategorized</string></value></member>
<member><name>term_id</name><value><string>1</string></value></member>
<member><name>name</name><value><string>Uncategorized</string></value></member>
<member><name>slug</name><value><string>uncategorized</string></value></member>
<member><name>taxonomy</name><value><string>category</string></value></member>
</struct></value>
</data></array></value></param></params></methodResponse>`
    );
  }

  // --- wp.getPosts / metaWeblog.getRecentPosts ---
  if (method === "wp.getPosts" || method === "metaWeblog.getRecentPosts") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");
    try {
      const posts = await getAllPosts();
      const items = posts.map((p) => postToXmlRpc(p)).join("\n");
      return xml(
        `<methodResponse><params><param><value><array><data>
${items}
</data></array></value></param></params></methodResponse>`
      );
    } catch {
      return xml(
        `<methodResponse><params><param><value><array><data></data></array></value></param></params></methodResponse>`
      );
    }
  }

  // --- wp.getPost / metaWeblog.getPost ---
  if (method === "wp.getPost" || method === "metaWeblog.getPost") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");
    // Extract post_id (slug) — it's the string after the password
    const strings = [...body.matchAll(/<string>([^<]*)<\/string>/g)].map(
      (m) => m[1]
    );
    // For wp.getPost(blog_id, user, pass, post_id) — post_id could be after the auth strings
    // Find the slug by looking for it in our posts
    const posts = await getAllPosts();
    const slug = strings.find((s) => posts.some((p) => p.slug === s));
    const post = slug ? posts.find((p) => p.slug === slug) : posts[0];
    if (!post) return fault(404, "Post not found.");
    return xml(
      `<methodResponse><params><param>${postToXmlRpc(post)}</param></params></methodResponse>`
    );
  }

  // --- wp.newPost / metaWeblog.newPost ---
  if (method === "wp.newPost" || method === "metaWeblog.newPost") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");

    const titleMatch = body.match(
      /<name>title<\/name>\s*<value>(?:<string>)?([^<]+)/
    );
    const contentMatch =
      body.match(
        /<name>description<\/name>\s*<value>(?:<string>)?([^<]+)/
      ) ||
      body.match(
        /<name>post_content<\/name>\s*<value>(?:<string>)?([^<]+)/
      );

    const title = titleMatch?.[1] || "Untitled";
    let content = contentMatch?.[1] || "";
    const slug = slugify(title);
    const date = new Date().toISOString().split("T")[0];

    // Strip HTML if present
    if (content.includes("<p>") || content.includes("<br")) {
      content = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    // Unescape XML entities
    content = content
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${date}"
description: ""
---

${content.trim()}
`;

    const ok = await saveBlogPost(slug, markdown);
    if (!ok) return fault(500, "Failed to publish.");

    return xml(
      `<methodResponse><params><param><value><string>${slug}</string></value></param></params></methodResponse>`
    );
  }

  // --- wp.editPost / metaWeblog.editPost ---
  if (method === "wp.editPost" || method === "metaWeblog.editPost") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");

    // Extract post_id (slug)
    const strings = [...body.matchAll(/<string>([^<]*)<\/string>/g)].map(
      (m) => m[1]
    );
    const posts = await getAllPosts();
    const slug = strings.find((s) => posts.some((p) => p.slug === s));
    if (!slug) return fault(404, "Post not found.");

    const existing = posts.find((p) => p.slug === slug)!;

    const titleMatch = body.match(
      /<name>(?:title|post_title)<\/name>\s*<value>(?:<string>)?([^<]+)/
    );
    const contentMatch =
      body.match(
        /<name>description<\/name>\s*<value>(?:<string>)?([^<]+)/
      ) ||
      body.match(
        /<name>post_content<\/name>\s*<value>(?:<string>)?([^<]+)/
      );

    const title = titleMatch?.[1] || existing.title;
    let content = contentMatch?.[1] || existing.content;

    if (content.includes("<p>") || content.includes("<br")) {
      content = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "");
    }

    content = content
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const markdown = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${existing.date}"
description: "${existing.description.replace(/"/g, '\\"')}"
---

${content.trim()}
`;

    const ok = await saveBlogPost(slug, markdown);
    if (!ok) return fault(500, "Failed to update.");

    return xml(
      `<methodResponse><params><param><value><boolean>1</boolean></value></param></params></methodResponse>`
    );
  }

  // --- metaWeblog.newMediaObject / wp.uploadFile ---
  if (method === "metaWeblog.newMediaObject" || method === "wp.uploadFile") {
    if (!verifyAuth(body)) return fault(403, "Incorrect password.");

    const nameMatch = body.match(
      /<name>name<\/name>\s*<value>(?:<string>)?([^<]+)/
    );
    const bitsMatch = body.match(
      /<name>bits<\/name>\s*<value>\s*<base64>([^<]+)<\/base64>/
    );

    const fileName = nameMatch?.[1] || `upload-${Date.now()}`;
    const bits = bitsMatch?.[1] || "";

    if (!bits) return fault(400, "No file data.");

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const buffer = Buffer.from(bits, "base64");
    const key = `uploads/${safeName}`;

    await r2Put(key, buffer, "image/jpeg");
    const publicUrl = r2AbsoluteUrl(key, req);

    return xml(
      `<methodResponse><params><param><value><struct>
<member><name>id</name><value><string>${Date.now()}</string></value></member>
<member><name>file</name><value><string>${safeName}</string></value></member>
<member><name>url</name><value><string>${publicUrl}</string></value></member>
<member><name>type</name><value><string>image/jpeg</string></value></member>
</struct></value></param></params></methodResponse>`
    );
  }

  // Unknown method — return supported methods
  return xml(
    `<methodResponse><params><param><value><array><data>
<value><string>system.listMethods</string></value>
<value><string>wp.getUsersBlogs</string></value>
<value><string>wp.getPosts</string></value>
<value><string>wp.getPost</string></value>
<value><string>wp.newPost</string></value>
<value><string>wp.editPost</string></value>
<value><string>wp.getOptions</string></value>
<value><string>wp.getCategories</string></value>
<value><string>wp.getTerms</string></value>
<value><string>metaWeblog.newPost</string></value>
<value><string>metaWeblog.editPost</string></value>
<value><string>metaWeblog.getPost</string></value>
<value><string>metaWeblog.getRecentPosts</string></value>
<value><string>metaWeblog.newMediaObject</string></value>
</data></array></value></param></params></methodResponse>`
  );
}
