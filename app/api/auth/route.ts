import { NextRequest, NextResponse } from "next/server";

const PUBLISH_SECRET = process.env.PUBLISH_SECRET!;
const SITE_URL =
  process.env.SITE_URL || "https://andypandy.org";

// Store codes temporarily (in-memory, reset on redeploy — fine for personal use)
const codes = new Map<string, { redirect_uri: string; client_id: string }>();

// GET — authorization endpoint: show a simple login page
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const redirect_uri = params.get("redirect_uri") || "";
  const client_id = params.get("client_id") || "";
  const state = params.get("state") || "";
  const response_type = params.get("response_type") || "id";

  return new NextResponse(
    `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; width: 90%; }
  h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
  p { color: #666; font-size: 0.9rem; margin: 0 0 1.5rem; }
  input[type=password] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; margin-bottom: 1rem; box-sizing: border-box; }
  button { width: 100%; padding: 0.75rem; background: #000; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  button:hover { background: #333; }
  .error { color: #e00; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
</style></head>
<body><div class="card">
  <h1>Authorize ${client_id || "app"}</h1>
  <p>Enter your publish secret to grant access.</p>
  <form method="POST" action="/api/auth">
    <input type="hidden" name="redirect_uri" value="${redirect_uri}">
    <input type="hidden" name="client_id" value="${client_id}">
    <input type="hidden" name="state" value="${state}">
    <input type="hidden" name="response_type" value="${response_type}">
    <input type="password" name="secret" placeholder="Publish secret" autofocus required>
    <button type="submit">Authorize</button>
  </form>
</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

// POST — validate secret, issue code, redirect back to client
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const secret = (form.get("secret") as string) || "";
  const redirect_uri = (form.get("redirect_uri") as string) || "";
  const client_id = (form.get("client_id") as string) || "";
  const state = (form.get("state") as string) || "";
  const response_type = (form.get("response_type") as string) || "id";

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

  const code = crypto.randomUUID();
  codes.set(code, { redirect_uri, client_id });

  // Clean up old codes after 5 min
  setTimeout(() => codes.delete(code), 5 * 60 * 1000);

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString(), 302);
}
