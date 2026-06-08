import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Vercel env vars sometimes carry stray newlines/whitespace when pasted in the
// dashboard. The S3 signer then sets HTTP headers with control chars and
// Node's undici fails with "Invalid character in header content". Trim defensively.
function envTrim(name: string): string {
  return (process.env[name] || "").trim();
}

const s3 = new S3Client({
  region: "auto",
  endpoint: envTrim("R2_ENDPOINT") || undefined,
  credentials: {
    accessKeyId: envTrim("R2_ACCESS_KEY_ID"),
    secretAccessKey: envTrim("R2_SECRET_ACCESS_KEY"),
  },
});

const BUCKET = envTrim("R2_BUCKET_NAME") || "afilmory-photos";

// Public base for uploads. If unset, callers should route through /api/uploads
// (the Next.js streaming proxy in app/api/uploads/[...path]/route.ts).
const PUBLIC_BASE = envTrim("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

export { s3 as r2Client, BUCKET as R2_BUCKET };

export async function r2Get(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export async function r2GetText(key: string): Promise<string | null> {
  const buf = await r2Get(key);
  return buf ? buf.toString("utf8") : null;
}

export async function r2GetStream(key: string): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string | undefined;
  contentLength: number | undefined;
} | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export async function r2Put(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function r2Delete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function r2Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: unknown) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

export async function r2List(prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
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
    if (res.Contents) out.push(...res.Contents);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** Public URL for an R2 object. Prefers R2_PUBLIC_BASE_URL; otherwise routes through the in-app proxy. */
export function r2PublicUrl(key: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${encodeURI(key)}`;
  // Streaming proxy lives at app/api/uploads/[...path]/route.ts — only works
  // for keys that start with "uploads/". For other prefixes, callers must
  // set R2_PUBLIC_BASE_URL. No trailing slash so Next doesn't 308.
  return `/api/uploads/${encodeURI(key.replace(/^uploads\//, ""))}`;
}

/** Returns an absolute URL even when r2PublicUrl produces a server-relative path. */
export function r2AbsoluteUrl(key: string, request: Request): string {
  const url = r2PublicUrl(key);
  if (url.startsWith("/")) {
    const origin = new URL(request.url).origin;
    return origin + url;
  }
  return url;
}

export async function r2PresignedGet(key: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } });
  return (
    code.name === "NoSuchKey" ||
    code.Code === "NoSuchKey" ||
    code.name === "NotFound" ||
    code.$metadata?.httpStatusCode === 404
  );
}
