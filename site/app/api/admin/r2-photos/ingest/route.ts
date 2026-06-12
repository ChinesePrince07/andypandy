import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { ingestAfilmoryPhoto } from "@/lib/afilmory";

export const dynamic = "force-dynamic";
// Each key triggers an afilmory ingest (download + thumbnail + EXIF), processed
// sequentially — give the batch room beyond the default function timeout.
export const maxDuration = 300;

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");

function publicUrl(key: string, origin: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${encodeURI(key)}`;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${origin}/api/r2/${encoded}`;
}

// POST { keys: string[] } — register freshly-uploaded R2 originals into
// afilmory's manifest (thumbnail + EXIF + date) so they show on the live
// gallery. Called by the iOS app after its presigned PUTs succeed.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const keys = Array.isArray(body?.keys) ? (body.keys as string[]) : [];
  if (!keys.length) {
    return Response.json({ error: "No keys provided" }, { status: 400 });
  }

  let origin = "";
  try {
    origin = new URL(req.url).origin;
  } catch {
    // ignore
  }

  // Process sequentially — each ingest downloads + thumbnails an image, so
  // running them in parallel risks the function's memory/time limits.
  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const key of keys) {
    const r = await ingestAfilmoryPhoto(publicUrl(key, origin), key);
    results.push({ key, ok: r.ok, error: r.ok ? undefined : r.error });
  }

  const ingested = results.filter((r) => r.ok).length;
  return Response.json({ ingested, total: keys.length, results });
}
