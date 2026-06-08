import { NextRequest } from "next/server";
import { r2GetStream } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

// Streams /uploads/* objects from R2 through the Next.js server.
// Used when R2_PUBLIC_BASE_URL is not configured (so blobs aren't exposed
// directly). Cached aggressively because uploads are immutable by convention.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path?.length) {
    return new Response("Not found", { status: 404 });
  }

  const key = `uploads/${path.map(decodeURIComponent).join("/")}`;
  const obj = await r2GetStream(key);
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
