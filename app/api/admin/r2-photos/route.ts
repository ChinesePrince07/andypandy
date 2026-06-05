import { NextRequest } from "next/server";
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2Client as s3, R2_BUCKET as BUCKET } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
const DEPLOY_HOOK = (process.env.AFILMORY_DEPLOY_HOOK || "").trim();

function originFromRequest(req: NextRequest): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|avif)$/i;

// Returns a fetchable absolute URL. Prefers a configured public R2 domain;
// otherwise routes through the in-app `/api/r2/<key>/` streaming proxy so
// browsers and the iOS app can render images without R2 being public.
function publicUrl(key: string, origin: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${encodeURI(key)}`;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  // No trailing slash — Next 308-redirects catch-all binary routes that end in
  // a file extension back to the no-slash form, and URLSession on iOS may drop
  // headers (or stall) following that hop.
  return `${origin}/api/r2/${encoded}`;
}

async function triggerDeploy(): Promise<boolean> {
  if (!DEPLOY_HOOK) return false;
  try {
    await fetch(DEPLOY_HOOK, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

// GET — list bucket contents (optional ?prefix=)
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") || undefined;
  const objects: _Object[] = [];
  let token: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    if (res.Contents) objects.push(...res.Contents);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  const origin = originFromRequest(req);
  const photos = objects
    .filter((o) => o.Key && IMAGE_EXT.test(o.Key))
    .map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? null,
      url: publicUrl(o.Key!, origin),
    }));

  return Response.json({ photos, prefix: prefix ?? "" });
}

// DELETE — remove one or more keys. Body: { keys: string[], triggerDeploy?: boolean }
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const keys = Array.isArray(body?.keys) ? (body.keys as string[]) : [];
  if (!keys.length) {
    return Response.json({ error: "No keys provided" }, { status: 400 });
  }

  const result = await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    })
  );

  const deleted = (result.Deleted ?? []).map((d) => d.Key).filter((k): k is string => !!k);
  const failed = (result.Errors ?? []).map((e) => ({ key: e.Key, code: e.Code, message: e.Message }));

  const deployTriggered = body?.triggerDeploy === false ? false : (deleted.length > 0 ? await triggerDeploy() : false);
  return Response.json({ deleted: deleted.length, failed, deployTriggered });
}
