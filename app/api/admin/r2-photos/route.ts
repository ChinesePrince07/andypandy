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

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|avif)$/i;
const ORIGINAL_PREFIX = "photos/original/";
const THUMB_PREFIX = "photos/thumb/";

function originFromRequest(req: NextRequest): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

// Returns a fetchable absolute URL. Prefers a configured public R2 domain;
// otherwise routes through the in-app /api/r2/<key>/ streaming proxy.
function publicUrl(key: string, origin: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${encodeURI(key)}`;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
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

async function listAll(prefix?: string): Promise<_Object[]> {
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
  return objects;
}

function stemOf(key: string, prefix: string): string {
  return key.slice(prefix.length).replace(/\.[^.]+$/, "");
}

// GET — list "photo" units. Each unit pairs an afilmory original with its
// matching thumbnail. Root-level files act as their own thumbnail.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") || undefined;
  const objects = await listAll(prefix);
  const origin = originFromRequest(req);

  // Build lookup of thumbnails by stem so we can pair with originals.
  const thumbsByStem = new Map<string, _Object>();
  for (const o of objects) {
    if (o.Key?.startsWith(THUMB_PREFIX) && IMAGE_EXT.test(o.Key)) {
      thumbsByStem.set(stemOf(o.Key, THUMB_PREFIX), o);
    }
  }

  type Photo = {
    key: string;
    thumbnailKey: string | null;
    size: number;
    lastModified: string | null;
    url: string;
    thumbnailUrl: string;
  };

  const photos: Photo[] = [];

  for (const o of objects) {
    if (!o.Key || !IMAGE_EXT.test(o.Key)) continue;
    if (o.Key.startsWith(THUMB_PREFIX)) continue; // not a primary entry

    let thumbnailKey: string | null = null;
    if (o.Key.startsWith(ORIGINAL_PREFIX)) {
      const stem = stemOf(o.Key, ORIGINAL_PREFIX);
      thumbnailKey = thumbsByStem.get(stem)?.Key ?? null;
    }

    const url = publicUrl(o.Key, origin);
    photos.push({
      key: o.Key,
      thumbnailKey,
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? null,
      url,
      thumbnailUrl: thumbnailKey ? publicUrl(thumbnailKey, origin) : url,
    });
  }

  // Sort newest first
  photos.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));

  return Response.json({ photos, prefix: prefix ?? "" });
}

// DELETE — remove originals + matching thumbnails. Body: { keys: string[], triggerDeploy?: boolean }
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const keys = Array.isArray(body?.keys) ? (body.keys as string[]) : [];
  if (!keys.length) {
    return Response.json({ error: "No keys provided" }, { status: 400 });
  }

  // Expand each original key to also delete its sidecar thumbnail.
  const toDelete = new Set<string>();
  for (const k of keys) {
    toDelete.add(k);
    if (k.startsWith(ORIGINAL_PREFIX)) {
      const stem = stemOf(k, ORIGINAL_PREFIX);
      // Try common thumbnail extensions — the build deterministically picks one
      // but we can't tell without a HEAD round-trip per key, so attempt all.
      for (const ext of ["webp", "jpg", "jpeg", "png", "avif"]) {
        toDelete.add(`${THUMB_PREFIX}${stem}.${ext}`);
      }
    }
  }

  const result = await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: Array.from(toDelete).map((k) => ({ Key: k })) },
    })
  );

  const deleted = (result.Deleted ?? []).map((d) => d.Key).filter((k): k is string => !!k);
  const failed = (result.Errors ?? []).map((e) => ({ key: e.Key, code: e.Code, message: e.Message }));

  const deployTriggered = body?.triggerDeploy === false ? false : (deleted.length > 0 ? await triggerDeploy() : false);
  return Response.json({ deleted: deleted.length, failed, deployTriggered });
}
