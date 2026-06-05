import { NextRequest } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "afilmory-photos";
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const DEPLOY_HOOK = process.env.AFILMORY_DEPLOY_HOOK || "";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|avif)$/i;

function publicUrl(key: string): string {
  if (!PUBLIC_BASE) return "";
  return `${PUBLIC_BASE}/${encodeURI(key)}`;
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

  const photos = objects
    .filter((o) => o.Key && IMAGE_EXT.test(o.Key))
    .map((o) => ({
      key: o.Key!,
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? null,
      url: publicUrl(o.Key!),
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

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    })
  );

  const deployTriggered = body?.triggerDeploy === false ? false : await triggerDeploy();
  return Response.json({ deleted: keys.length, deployTriggered });
}
