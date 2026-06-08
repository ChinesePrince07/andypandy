import { NextRequest } from "next/server";
import { r2GetStream } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

// Streams any R2 object through Next.js so we don't need a public R2 domain.
// Used by /api/admin/r2-photos to give the iOS app + browsers fetchable URLs
// regardless of whether R2_PUBLIC_BASE_URL is configured.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  if (!key?.length) {
    return new Response("Not found", { status: 404 });
  }

  const fullKey = key.map(decodeURIComponent).join("/");
  const obj = await r2GetStream(fullKey);
  if (!obj) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType || "application/octet-stream");
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { status: 200, headers });
}
