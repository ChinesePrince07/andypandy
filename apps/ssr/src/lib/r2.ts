import { AwsClient } from 'aws4fetch'

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? ''
const BUCKET = process.env.R2_BUCKET ?? ''
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? ''
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? ''
const PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
const S3_ENDPOINT = (process.env.R2_S3_ENDPOINT || `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, '')

const aws = new AwsClient({
  accessKeyId: ACCESS_KEY_ID,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: 'auto',
  service: 's3',
})

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

function objectUrl(key: string): string {
  return `${S3_ENDPOINT}/${BUCKET}/${encodeKey(key)}`
}

/** Public (browser-facing) URL for an object key. */
export function publicUrl(key: string): string {
  return `${PUBLIC_BASE_URL}/${encodeKey(key)}`
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Extract the object key from a stored public URL (inverse of publicUrl). */
export function keyFromPublicUrl(url: string): string {
  if (!url) return ''
  try {
    const path =
      PUBLIC_BASE_URL && url.startsWith(`${PUBLIC_BASE_URL}/`)
        ? url.slice(PUBLIC_BASE_URL.length + 1)
        : new URL(url).pathname.replace(/^\/+/, '')
    return path
      .split('/')
      .map((s) => safeDecode(s))
      .join('/')
  } catch {
    return ''
  }
}

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/** Upload bytes to R2. Returns the public URL. */
export async function uploadToR2(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
  opts?: { immutable?: boolean },
): Promise<string> {
  const cacheControl = opts?.immutable === false ? 'no-store, max-age=0' : IMMUTABLE_CACHE
  // aws4fetch needs a body with byteLength (string | ArrayBuffer | ArrayBufferView);
  // Uint8Array satisfies that at runtime. The cast sidesteps TS 5.7 BodyInit generics friction.
  const body = (data instanceof Uint8Array ? data : new Uint8Array(data)) as unknown as BodyInit
  const res = await aws.fetch(objectUrl(key), {
    method: 'PUT',
    body,
    headers: { 'content-type': contentType, 'cache-control': cacheControl },
  })
  if (!res.ok) {
    throw new Error(`R2 upload failed for ${key}: ${res.status} ${await res.text().catch(() => '')}`)
  }
  return publicUrl(key)
}

/** Download an object from R2. Returns null on 404. */
export async function getFromR2(key: string): Promise<Buffer | null> {
  const res = await aws.fetch(objectUrl(key), { method: 'GET', cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 get failed for ${key}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Delete an object by key. 404 is treated as success. */
export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return
  const res = await aws.fetch(objectUrl(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed for ${key}: ${res.status}`)
  }
}

/** Delete an object given its public URL (compat with old deleteFromBlob(url)). */
export async function deleteFromR2ByUrl(url: string): Promise<void> {
  const key = keyFromPublicUrl(url)
  if (!key) {
    console.warn(`[deleteFromR2ByUrl] could not derive key from URL: ${url}`)
    return
  }
  await deleteFromR2(key)
}

/** Generate a presigned PUT URL for direct browser upload. Content-Type is left unsigned. */
export async function presignPutUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds))
  const signed = await aws.sign(url.toString(), { method: 'PUT', aws: { signQuery: true } })
  return signed.url
}

export interface R2Object {
  pathname: string
  url: string
  size: number
  uploadedAt: Date
  contentType?: string
}

/** List all objects (optionally under a prefix). Shape mirrors the old listAllBlobs() entries. */
export async function listR2(prefix?: string): Promise<R2Object[]> {
  const out: R2Object[] = []
  let token: string | undefined
  do {
    const u = new URL(`${S3_ENDPOINT}/${BUCKET}`)
    u.searchParams.set('list-type', '2')
    u.searchParams.set('max-keys', '1000')
    if (prefix) u.searchParams.set('prefix', prefix)
    if (token) u.searchParams.set('continuation-token', token)
    const res = await aws.fetch(u.toString(), { method: 'GET', cache: 'no-store' })
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`)
    const xml = await res.text()
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1]
      const key = decodeXml(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '')
      if (!key) continue
      const size = Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? '0')
      const lm = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1]
      out.push({ pathname: key, url: publicUrl(key), size, uploadedAt: lm ? new Date(lm) : new Date(0) })
    }
    const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/.test(xml)
    token = truncated
      ? decodeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '')
      : undefined
  } while (token)
  return out
}

function decodeXml(s: string): string {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}
