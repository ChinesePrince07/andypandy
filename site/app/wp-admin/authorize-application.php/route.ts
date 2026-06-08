import { NextRequest, NextResponse } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL =
  process.env.SITE_URL || "https://andypandy.org";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET — show authorization form for WordPress app
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const app_name = params.get("app_name") || "Unknown App";
  const app_id = params.get("app_id") || "";
  const success_url = params.get("success_url") || "";
  const reject_url = params.get("reject_url") || "";

  return new NextResponse(
    `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize ${esc(app_name)}</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; width: 90%; }
  h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
  p { color: #666; font-size: 0.9rem; margin: 0 0 1.5rem; }
  input[type=password] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; margin-bottom: 1rem; box-sizing: border-box; }
  button { width: 100%; padding: 0.75rem; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; margin-bottom: 0.5rem; }
  .approve { background: #000; color: #fff; }
  .approve:hover { background: #333; }
  .reject { display: block; text-align: center; padding: 0.75rem; background: #e5e5e5; color: #333; border-radius: 8px; text-decoration: none; font-size: 1rem; }
  .reject:hover { background: #d5d5d5; }
</style></head>
<body><div class="card">
  <h1>Authorize ${esc(app_name)}</h1>
  <p>Enter your publish secret to grant access.</p>
  <form method="POST">
    <input type="hidden" name="app_name" value="${esc(app_name)}">
    <input type="hidden" name="app_id" value="${esc(app_id)}">
    <input type="hidden" name="success_url" value="${esc(success_url)}">
    <input type="hidden" name="reject_url" value="${esc(reject_url)}">
    <input type="password" name="secret" placeholder="Publish secret" autofocus required>
    <button type="submit" class="approve">Authorize</button>
  </form>
  ${reject_url ? `<a href="${esc(reject_url)}" class="reject">Cancel</a>` : ""}
</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// POST — validate secret, redirect back to app with credentials
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const secret = (form.get("secret") as string) || "";
  const success_url = (form.get("success_url") as string) || "";
  const reject_url = (form.get("reject_url") as string) || "";

  if (secret !== PUBLISH_SECRET) {
    return new NextResponse(
      `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}p{color:#e00;}</style>
</head><body><p>Wrong secret. <a href="javascript:history.back()">Try again</a></p></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!success_url) {
    return new NextResponse("Missing success_url", { status: 400 });
  }

  // Redirect to the app's success_url with credentials
  const url = new URL(success_url);
  url.searchParams.set("site_url", SITE_URL);
  url.searchParams.set("user_login", "admin");
  url.searchParams.set("password", PUBLISH_SECRET);

  return NextResponse.redirect(url.toString(), 302);
}
