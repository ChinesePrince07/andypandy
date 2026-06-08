# Vercel Blob → Cloudflare R2 Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all photo storage (originals, thumbnails, `manifest.json`) from Vercel Blob to Cloudflare R2, with the browser loading images directly from R2's public URL and uploads going via presigned `PUT`.

**Architecture:** A new `apps/ssr/src/lib/r2.ts` wraps `aws4fetch` for signed R2 ops + presigned upload URLs + public-URL helpers, deliberately mirroring the old Blob lib's function shapes to minimize call-site churn. `apps/ssr/src/lib/manifest.ts` reads/writes `manifest.json` on R2 (signed, fresh). `lib/blob.ts` is deleted. A standalone `scripts/migrate-blob-to-r2.ts` copies existing Blob assets to R2 and rewrites the manifest.

**Tech Stack:** Next.js 16 (SSR app), `aws4fetch` (new dep), `sharp`, R2 (S3-compatible, region `auto`).

**Testing note:** The SSR app has no unit-test harness, and adding one is out of scope. Verification is via a runnable integration script (`scripts/verify-r2.ts`) that round-trips against real R2 using `/.env`, plus `pnpm --filter @afilmory/ssr type-check`/build and dev-server checks. Each task's verification step states the exact command and expected output.

**Env (already set locally in `/.env` and in Vercel):** `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`. `R2_S3_ENDPOINT` is optional (derived from account id).

---

## File structure

| File | Responsibility |
|---|---|
| `apps/ssr/src/lib/r2.ts` (new) | Low-level R2: signed PUT/GET/DELETE/LIST, presigned PUT URL, public-URL helpers |
| `apps/ssr/src/lib/manifest.ts` (new) | `getManifest`/`getManifestSafe`/`saveManifest` on R2 |
| `apps/ssr/src/lib/blob.ts` (delete) | Removed after all callers migrated |
| `apps/ssr/src/env.ts` (modify) | Add R2 vars, drop `BLOB_READ_WRITE_TOKEN` |
| `apps/ssr/src/app/api/admin/photos/upload/route.ts` (modify) | Issue presigned PUT URL + key |
| `apps/ssr/src/app/admin/(protected)/upload/page.tsx` (modify) | Client: presign → PUT → process |
| `apps/ssr/src/app/api/admin/photos/process/route.ts` (modify) | Read original from R2, thumb→R2, manifest; port recover/cleanup/fix-thumbhash |
| `apps/ssr/src/app/api/admin/photos/[id]/route.ts` (modify) | Delete + writeExif on R2 |
| `apps/ssr/src/app/api/admin/photos/bulk-delete/route.ts` (modify) | Delete on R2 |
| `apps/ssr/src/app/api/admin/scan/route.ts` (modify) | List/recover via R2 |
| `apps/ssr/src/app/api/admin/recover/route.ts` (modify) | List/recover via R2 |
| All other `~/lib/blob` importers (modify) | Import `getManifest*` from `~/lib/manifest` |
| `scripts/verify-r2.ts` (new) | Integration check of `r2.ts` against real R2 |
| `scripts/migrate-blob-to-r2.ts` (new) | One-time Blob→R2 copy + manifest rewrite |
| `apps/ssr/package.json` (modify) | Add `aws4fetch` |
| `.env.template` (modify) | Document R2 vars |

`apps/web` (frontend) is **not** touched — it reads `photo.thumbnailUrl`/`originalUrl`, which simply become R2 URLs.

---

## Task 1: Add the `aws4fetch` dependency

**Files:**
- Modify: `apps/ssr/package.json`

- [ ] **Step 1: Add the dependency**

Run:
```bash
cd /home/andy/afilmory-photos
pnpm --filter @afilmory/ssr add aws4fetch@1.0.20
```
Expected: `aws4fetch` appears under `apps/ssr/package.json` `dependencies`; lockfile updates.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('aws4fetch', { paths: ['apps/ssr'] }) && console.log('ok')"`
Expected: prints `ok` (or use `pnpm --filter @afilmory/ssr exec node -e "import('aws4fetch').then(()=>console.log('ok'))"`).

- [ ] **Step 3: Commit**

```bash
git add apps/ssr/package.json pnpm-lock.yaml
git commit -m "build: add aws4fetch to ssr for R2 access"
```

---

## Task 2: Create the R2 client library

**Files:**
- Create: `apps/ssr/src/lib/r2.ts`

- [ ] **Step 1: Write `r2.ts`**

```ts
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

/** Extract the object key from a stored public URL (inverse of publicUrl). */
export function keyFromPublicUrl(url: string): string {
  if (!url) return ''
  try {
    const path = PUBLIC_BASE_URL && url.startsWith(`${PUBLIC_BASE_URL}/`)
      ? url.slice(PUBLIC_BASE_URL.length + 1)
      : new URL(url).pathname.replace(/^\/+/, '')
    return path.split('/').map((s) => safeDecode(s)).join('/')
  } catch {
    return ''
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
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
  const body = data instanceof Uint8Array ? data : new Uint8Array(data)
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
    token = truncated ? decodeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') : undefined
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
```

- [ ] **Step 2: Type-check the new file compiles** (full check happens in Task 5; here just sanity)

Run: `pnpm --filter @afilmory/ssr exec tsc --noEmit --skipLibCheck src/lib/r2.ts 2>&1 | head -20 || true`
Expected: no errors referencing `r2.ts` (module-resolution noise about other imports is fine; the real gate is Task 5).

- [ ] **Step 3: Commit**

```bash
git add apps/ssr/src/lib/r2.ts
git commit -m "feat: add R2 storage client (aws4fetch)"
```

---

## Task 3: Create the manifest library (R2-backed)

**Files:**
- Create: `apps/ssr/src/lib/manifest.ts`

- [ ] **Step 1: Write `manifest.ts`**

```ts
import type { AfilmoryManifest } from '@afilmory/typing'

import { getFromR2, uploadToR2 } from './r2'

const MANIFEST_KEY = 'manifest.json'

const EMPTY_MANIFEST: AfilmoryManifest = {
  version: 'v10',
  data: [],
  cameras: [],
  lenses: [],
  albums: [],
}

function emptyManifest(): AfilmoryManifest {
  return { ...EMPTY_MANIFEST, data: [], cameras: [], lenses: [], albums: [] }
}

/**
 * Read the manifest from R2 via a signed origin GET (no-store), so reads are
 * always fresh — preserving the stale-read fix that previously plagued Blob.
 */
export async function getManifest(): Promise<AfilmoryManifest> {
  const buf = await getFromR2(MANIFEST_KEY)
  if (!buf) return emptyManifest()
  const manifest = JSON.parse(buf.toString('utf8')) as AfilmoryManifest
  console.log(`[getManifest] Loaded ${manifest.data.length} photos from R2`)
  return manifest
}

/** Read-only safe variant for SSR rendering: never throws. */
export async function getManifestSafe(): Promise<AfilmoryManifest> {
  try {
    return await getManifest()
  } catch (error) {
    console.error('Failed to load manifest:', error)
    return emptyManifest()
  }
}

/** Write the manifest to R2 (not cached). Returns the public URL. */
export async function saveManifest(manifest: AfilmoryManifest): Promise<string> {
  const url = await uploadToR2(MANIFEST_KEY, Buffer.from(JSON.stringify(manifest)), 'application/json', {
    immutable: false,
  })
  console.log(`[saveManifest] Saved manifest with ${manifest.data.length} photos to R2`)
  return url
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ssr/src/lib/manifest.ts
git commit -m "feat: add R2-backed manifest read/write"
```

---

## Task 4: Update SSR env schema

**Files:**
- Modify: `apps/ssr/src/env.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    ADMIN_PASSWORD: z.string().min(1).optional(),
    DEPLOY_HOOK: z.string().url().optional(),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_PUBLIC_BASE_URL: z.string().url(),
    R2_S3_ENDPOINT: z.string().url().optional(),
  },
  runtimeEnv: {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DEPLOY_HOOK: process.env.DEPLOY_HOOK,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    R2_S3_ENDPOINT: process.env.R2_S3_ENDPOINT,
  },
})
```

- [ ] **Step 2: Confirm nothing else references the removed `BLOB_READ_WRITE_TOKEN` via `env`**

Run: `grep -rn "env.BLOB_READ_WRITE_TOKEN\|BLOB_READ_WRITE_TOKEN" apps/ssr/src --include=*.ts --include=*.tsx`
Expected: no matches (the old `blob.ts` read `process.env.BLOB_READ_WRITE_TOKEN` directly and is removed in Task 11). If any remain, they belong to files handled in later tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/ssr/src/env.ts
git commit -m "feat: add R2 env vars, drop Blob token from env schema"
```

---

## Task 5: Write & run the R2 verification script

**Files:**
- Create: `scripts/verify-r2.ts`

- [ ] **Step 1: Write the script**

```ts
import 'dotenv/config'

import { deleteFromR2, getFromR2, listR2, presignPutUrl, publicUrl, uploadToR2 } from '../apps/ssr/src/lib/r2'

async function main() {
  const key = 'photos/_verify/roundtrip.txt'
  const body = `verify-${Date.now()}`

  console.log('1. uploadToR2…')
  const url = await uploadToR2(key, Buffer.from(body), 'text/plain', { immutable: false })
  console.log('   public url:', url)

  console.log('2. getFromR2…')
  const got = await getFromR2(key)
  if (got?.toString() !== body) throw new Error(`getFromR2 mismatch: got ${got?.toString()}`)
  console.log('   ok, content matches')

  console.log('3. public fetch…')
  const pub = await fetch(publicUrl(key))
  console.log('   public GET status:', pub.status)

  console.log('4. presignPutUrl + PUT…')
  const pkey = 'photos/_verify/presigned.txt'
  const put = await fetch(await presignPutUrl(pkey), { method: 'PUT', body: 'presigned-ok' })
  console.log('   presigned PUT status:', put.status)
  const back = await getFromR2(pkey)
  if (back?.toString() !== 'presigned-ok') throw new Error('presigned PUT did not persist')
  console.log('   ok, presigned upload persisted')

  console.log('5. listR2(photos/_verify/)…')
  const list = await listR2('photos/_verify/')
  console.log('   found:', list.map((o) => o.pathname))

  console.log('6. cleanup…')
  await deleteFromR2(key)
  await deleteFromR2(pkey)
  const goneA = await getFromR2(key)
  const goneB = await getFromR2(pkey)
  if (goneA || goneB) throw new Error('cleanup failed')
  console.log('   ok, deleted')

  console.log('\nALL R2 CHECKS PASSED ✅')
}

main().catch((e) => {
  console.error('R2 VERIFY FAILED ❌', e)
  process.exit(1)
})
```

- [ ] **Step 2: Run it**

Run: `pnpm tsx scripts/verify-r2.ts`
Expected: ends with `ALL R2 CHECKS PASSED ✅`; step 3 public GET status `200`; step 4 presigned PUT status `200`; listR2 shows the two `_verify` keys.

> If `pnpm tsx` isn't available at root, use `pnpm dlx tsx scripts/verify-r2.ts`. The script loads `/.env` via `dotenv/config`.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-r2.ts
git commit -m "test: add R2 integration verification script"
```

---

## Task 6: Issue presigned upload URLs (replace Blob client-upload handler)

**Files:**
- Modify: `apps/ssr/src/app/api/admin/photos/upload/route.ts` (full replace)

- [ ] **Step 1: Replace the file**

```ts
import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { presignPutUrl } from '~/lib/r2'

export const dynamic = 'force-dynamic'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tiff',
}

function deriveExt(filename: string, contentType?: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]+)$/)
  if (m) return m[1].toLowerCase()
  if (contentType && EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType]
  return 'jpg'
}

// Returns a presigned PUT URL so the browser uploads the original directly to R2,
// bypassing Vercel's ~4.5MB function request-body limit.
export async function POST(req: NextRequest): Promise<Response> {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { filename, contentType } = (await req.json()) as { filename?: string; contentType?: string }
    if (!filename) {
      return Response.json({ error: 'Missing filename' }, { status: 400 })
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const ext = deriveExt(filename, contentType)
    const key = `photos/original/${id}.${ext}`
    const uploadUrl = await presignPutUrl(key, 600)
    return Response.json({ id, key, uploadUrl })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create upload URL' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ssr/src/app/api/admin/photos/upload/route.ts
git commit -m "feat: presigned R2 upload URL endpoint"
```

---

## Task 7: Update the client upload flow

**Files:**
- Modify: `apps/ssr/src/app/admin/(protected)/upload/page.tsx`

- [ ] **Step 1: Remove the Blob client import**

Find and delete this line near the top:
```tsx
import { upload } from '@vercel/blob/client'
```

- [ ] **Step 2: Replace the per-file upload body inside `handleUploadAll`**

Replace this block:
```tsx
        // Step 1: Upload directly to Vercel Blob (bypasses 4.5MB serverless limit)
        const blob = await upload(uploadFile.file.name, uploadFile.file, {
          access: 'public',
          handleUploadUrl: '/api/admin/photos/upload',
        })

        // Step 2: Process metadata server-side (EXIF, thumbnail, manifest, AI)
        const res = await fetch('/api/admin/photos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl: blob.url,
            filename: uploadFile.file.name,
            tags: uploadFile.tags.length > 0 ? uploadFile.tags : undefined,
          }),
        })
```

with:
```tsx
        // Step 1: Get a presigned R2 upload URL
        const presignRes = await fetch('/api/admin/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: uploadFile.file.name, contentType: uploadFile.file.type }),
        })
        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => ({ error: 'Failed to get upload URL' }))
          updateFileStatus(i, 'error', data.error || 'Failed to get upload URL')
          continue
        }
        const { id, key, uploadUrl } = await presignRes.json()

        // Step 2: Upload the original directly to R2 (bypasses 4.5MB serverless limit)
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: uploadFile.file,
          headers: uploadFile.file.type ? { 'Content-Type': uploadFile.file.type } : undefined,
        })
        if (!putRes.ok) {
          updateFileStatus(i, 'error', `Upload to storage failed (${putRes.status})`)
          continue
        }

        // Step 3: Process metadata server-side (EXIF, thumbnail, manifest, AI)
        const res = await fetch('/api/admin/photos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            key,
            filename: uploadFile.file.name,
            tags: uploadFile.tags.length > 0 ? uploadFile.tags : undefined,
          }),
        })
```

- [ ] **Step 3: Commit**

```bash
git add "apps/ssr/src/app/admin/(protected)/upload/page.tsx"
git commit -m "feat: client uploads originals to R2 via presigned PUT"
```

---

## Task 8: Process route — read from R2, write thumbnail + manifest to R2

**Files:**
- Modify: `apps/ssr/src/app/api/admin/photos/process/route.ts`

- [ ] **Step 1: Swap the storage imports**

Replace:
```ts
import { deleteFromBlob, getManifest, listAllBlobs, saveManifest, uploadToBlob } from '~/lib/blob'
```
with:
```ts
import { getManifest, saveManifest } from '~/lib/manifest'
import { deleteFromR2ByUrl, getFromR2, listR2, publicUrl, uploadToR2 } from '~/lib/r2'
```

- [ ] **Step 2: Replace the original-download + id block in the main `POST`**

Replace:
```ts
    const { blobUrl, filename, tags: userTags, title: userTitle } = body
    if (!blobUrl || !filename) {
      return Response.json({ error: 'Missing blobUrl or filename' }, { status: 400 })
    }

    // Download the uploaded blob
    const blobRes = await fetch(blobUrl)
    if (!blobRes.ok) {
      return Response.json({ error: 'Failed to download uploaded file' }, { status: 500 })
    }
    const buffer = Buffer.from(await blobRes.arrayBuffer())
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
```
with:
```ts
    const { id, key, filename, tags: userTags, title: userTitle } = body
    if (!id || !key || !filename) {
      return Response.json({ error: 'Missing id, key, or filename' }, { status: 400 })
    }

    // Download the original the browser uploaded to R2
    const buffer = await getFromR2(key)
    if (!buffer) {
      return Response.json({ error: 'Uploaded file not found in storage' }, { status: 500 })
    }
```

- [ ] **Step 3: Point the thumbnail upload + manifest item at R2**

Replace:
```ts
    // Upload thumbnail to Vercel Blob (original is already uploaded via client)
    const thumbnailUrl = await uploadToBlob(`photos/thumb/${id}.webp`, thumbnailBuffer, 'image/webp')
```
with:
```ts
    // Upload thumbnail to R2 (original is already in R2 at `key`)
    const thumbnailUrl = await uploadToR2(`photos/thumb/${id}.webp`, thumbnailBuffer, 'image/webp')
```

Then in the `photoItem` object, replace these two fields:
```ts
      originalUrl: blobUrl,
      ...
      s3Key: `photos/original/${id}.${ext}`,
```
with:
```ts
      originalUrl: publicUrl(key),
      ...
      s3Key: key,
```
(Leave `thumbnailUrl`, `format`, `size`, etc. as-is. The `ext`/`format` lines elsewhere stay.)

- [ ] **Step 4: Port `handleRecover` / `handleCleanup` to R2 (mechanical renames)**

Within this file apply these exact substitutions everywhere they appear inside `handleRecover` and `handleCleanup`:
- `await listAllBlobs()` → `await listR2()`
- `uploadToBlob(` → `uploadToR2(`
- `await deleteFromBlob(blob.url)` → `await deleteFromR2ByUrl(blob.url)`

The list-entry field names (`b.pathname`, `b.url`, `b.size`, `b.contentType`, `blob.uploadedAt`) are unchanged — `listR2()` returns the same shape (`contentType` is `undefined`, which the recover code already tolerates via its extension fallback).

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @afilmory/ssr exec tsc --noEmit 2>&1 | grep -i "process/route" || echo "process/route OK"`
Expected: `process/route OK` (other files may still error until their tasks are done; that's fine).

- [ ] **Step 6: Commit**

```bash
git add apps/ssr/src/app/api/admin/photos/process/route.ts
git commit -m "feat: process route reads/writes photos on R2"
```

---

## Task 9: Single-photo delete + EXIF-write on R2

**Files:**
- Modify: `apps/ssr/src/app/api/admin/photos/[id]/route.ts`

- [ ] **Step 1: Swap imports**

Replace:
```ts
import { deleteFromBlob, getManifest, saveManifest, uploadToBlob } from '~/lib/blob'
```
with:
```ts
import { getManifest, saveManifest } from '~/lib/manifest'
import { deleteFromR2ByUrl, getFromR2, uploadToR2 } from '~/lib/r2'
```

- [ ] **Step 2: Fix `writeExifToImage` to read/write via R2**

Replace:
```ts
    // Download original image
    const res = await fetch(photo.originalUrl)
    if (!res.ok) {
      return { success: false, error: `Failed to download original: ${res.status}` }
    }
    const buffer = Buffer.from(await res.arrayBuffer())
```
with:
```ts
    // Download original image from R2
    const buffer = await getFromR2(photo.s3Key)
    if (!buffer) {
      return { success: false, error: 'Failed to download original from storage' }
    }
```

And replace:
```ts
    await uploadToBlob(photo.s3Key, outputBuffer, contentType)
```
with:
```ts
    await uploadToR2(photo.s3Key, outputBuffer, contentType)
```

- [ ] **Step 3: Fix the `DELETE` handler**

Replace the two delete calls:
```ts
    await deleteFromBlob(photo.originalUrl)
```
→
```ts
    await deleteFromR2ByUrl(photo.originalUrl)
```
and
```ts
    await deleteFromBlob(photo.thumbnailUrl)
```
→
```ts
    await deleteFromR2ByUrl(photo.thumbnailUrl)
```
(Keep the surrounding logging/try-catch and the "save manifest first" ordering unchanged. The log strings mentioning "blob" can stay; they're cosmetic.)

- [ ] **Step 4: Commit**

```bash
git add "apps/ssr/src/app/api/admin/photos/[id]/route.ts"
git commit -m "feat: single-photo delete and EXIF-write use R2"
```

---

## Task 10: Bulk delete on R2

**Files:**
- Modify: `apps/ssr/src/app/api/admin/photos/bulk-delete/route.ts`

- [ ] **Step 1: Swap imports**

Replace:
```ts
import { deleteFromBlob, getManifest, saveManifest } from '~/lib/blob'
```
with:
```ts
import { getManifest, saveManifest } from '~/lib/manifest'
import { deleteFromR2ByUrl } from '~/lib/r2'
```

- [ ] **Step 2: Swap the two delete calls**

`await deleteFromBlob(photo.originalUrl)` → `await deleteFromR2ByUrl(photo.originalUrl)`
`await deleteFromBlob(photo.thumbnailUrl)` → `await deleteFromR2ByUrl(photo.thumbnailUrl)`

- [ ] **Step 3: Commit**

```bash
git add apps/ssr/src/app/api/admin/photos/bulk-delete/route.ts
git commit -m "feat: bulk delete uses R2"
```

---

## Task 11: Migrate remaining `~/lib/blob` importers, port scan/recover, delete `blob.ts`

**Files:**
- Modify: `apps/ssr/src/app/api/admin/scan/route.ts`
- Modify: `apps/ssr/src/app/api/admin/recover/route.ts`
- Modify (import path only): `apps/ssr/src/app/api/admin/fix-gps/route.ts`, `apps/ssr/src/app/api/admin/albums/route.ts`, `apps/ssr/src/app/api/admin/albums/[id]/route.ts`, `apps/ssr/src/app/api/admin/photos/generate-ai/route.ts`, `apps/ssr/src/app/lens/[lensName]/route.ts`, `apps/ssr/src/app/album/[albumId]/route.ts`, `apps/ssr/src/app/[...all]/route.ts`, `apps/ssr/src/app/api/og/lens/[lensName]/route.tsx`, `apps/ssr/src/app/api/og/album/[albumId]/route.tsx`, `apps/ssr/src/app/api/og/photo/[id]/route.tsx`, `apps/ssr/src/app/api/og/tag/[tag]/route.tsx`, `apps/ssr/src/app/api/og/camera/[make]/[model]/route.tsx`, `apps/ssr/src/app/tag/[tag]/route.ts`, `apps/ssr/src/app/route.ts`, `apps/ssr/src/app/camera/[make]/[model]/route.ts`, `apps/ssr/src/app/admin/(protected)/page.tsx`, `apps/ssr/src/app/admin/(protected)/albums/page.tsx`, `apps/ssr/src/app/admin/(protected)/albums/[id]/edit/page.tsx`, `apps/ssr/src/app/photos/[photoId]/prod.ts`, `apps/ssr/src/lib/ssr-meta.ts`
- Delete: `apps/ssr/src/lib/blob.ts`

- [ ] **Step 1: Manifest-only importers — swap import source**

For every file that imports only manifest functions from `~/lib/blob`, change the import source to `~/lib/manifest`. These import `getManifestSafe` and/or `getManifest`/`saveManifest`. Run this to find them:
```bash
grep -rln "from '~/lib/blob'" apps/ssr/src
```
For each, replace `from '~/lib/blob'` with `from '~/lib/manifest'` **unless** it also imports `uploadToBlob`/`deleteFromBlob`/`listAllBlobs` (those are `scan` and `recover`, handled in Step 2).

- [ ] **Step 2: Port `scan/route.ts` and `recover/route.ts` to R2**

Read each file, then:
- Replace the import line
  `import { getManifest, listAllBlobs, saveManifest, uploadToBlob } from '~/lib/blob'`
  with
  `import { getManifest, saveManifest } from '~/lib/manifest'`
  `import { listR2, publicUrl, uploadToR2 } from '~/lib/r2'`
  (drop `deleteFromBlob` if unused; add `deleteFromR2ByUrl` from `~/lib/r2` if the file deletes.)
- Apply the same mechanical substitutions as Task 8 Step 4:
  `await listAllBlobs()` → `await listR2()`; `uploadToBlob(` → `uploadToR2(`; `deleteFromBlob(<url>)` → `deleteFromR2ByUrl(<url>)`.
- Any place that set `originalUrl: blob.url` keeps working (`listR2` entries already expose `.url` = public URL).

- [ ] **Step 3: Delete `blob.ts` and confirm no references remain**

```bash
git rm apps/ssr/src/lib/blob.ts
grep -rn "lib/blob\|@vercel/blob" apps/ssr/src && echo "STILL REFERENCED — fix above" || echo "no blob references ✓"
```
Expected: `no blob references ✓`.

- [ ] **Step 4: Full type-check + build**

Run:
```bash
pnpm --filter @afilmory/ssr type-check
```
Expected: exits 0 (no errors). Fix any remaining import/type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A apps/ssr/src
git commit -m "refactor: migrate all SSR storage off Vercel Blob to R2"
```

---

## Task 12: Remove `@vercel/blob` dependency

**Files:**
- Modify: `apps/ssr/package.json`

- [ ] **Step 1: Confirm unused, then remove**

Run:
```bash
grep -rn "@vercel/blob" apps/ssr/src && echo "still used — STOP" || pnpm --filter @afilmory/ssr remove @vercel/blob
```
Expected: dependency removed (no `@vercel/blob` usages remain).

- [ ] **Step 2: Build to confirm**

Run: `pnpm --filter @afilmory/ssr type-check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/ssr/package.json pnpm-lock.yaml
git commit -m "build: drop @vercel/blob from ssr"
```

---

## Task 13: Migration script (Blob → R2)

**Files:**
- Create: `scripts/migrate-blob-to-r2.ts`

- [ ] **Step 1: Write the script**

```ts
import 'dotenv/config'

import { head } from '@vercel/blob'

import type { AfilmoryManifest, PhotoManifestItem } from '@afilmory/typing'

import { publicUrl, uploadToR2 } from '../apps/ssr/src/lib/r2'

const MANIFEST_KEY = 'manifest.json'
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
const DELETE_BLOBS = process.argv.includes('--delete-blobs')
const CONCURRENCY = 6

const CT_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', tiff: 'image/tiff', tif: 'image/tiff',
}

function contentTypeForKey(key: string, fallback = 'application/octet-stream'): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return CT_BY_EXT[ext] ?? fallback
}

async function readBlobManifest(): Promise<AfilmoryManifest> {
  if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required to read the source manifest')
  const meta = await head(MANIFEST_KEY, { token: BLOB_TOKEN })
  const res = await fetch(meta.downloadUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`)
  return (await res.json()) as AfilmoryManifest
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

function alreadyOnR2(url: string | null | undefined): boolean {
  return !!url && !!PUBLIC_BASE && url.startsWith(PUBLIC_BASE)
}

async function migratePhoto(photo: PhotoManifestItem): Promise<'skipped' | 'migrated'> {
  if (alreadyOnR2(photo.originalUrl) && alreadyOnR2(photo.thumbnailUrl)) return 'skipped'

  const originalKey = photo.s3Key || `photos/original/${photo.id}`
  const thumbKey = `photos/thumb/${photo.id}.webp`

  if (!alreadyOnR2(photo.originalUrl) && photo.originalUrl) {
    const buf = await download(photo.originalUrl)
    await uploadToR2(originalKey, buf, contentTypeForKey(originalKey, `image/${photo.format || 'jpeg'}`))
    photo.originalUrl = publicUrl(originalKey)
    photo.s3Key = originalKey
  }
  if (!alreadyOnR2(photo.thumbnailUrl) && photo.thumbnailUrl) {
    const buf = await download(photo.thumbnailUrl)
    await uploadToR2(thumbKey, buf, 'image/webp')
    photo.thumbnailUrl = publicUrl(thumbKey)
  }
  return 'migrated'
}

async function pool<T>(items: T[], n: number, fn: (item: T, idx: number) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        await fn(items[idx], idx)
      }
    }),
  )
}

async function main() {
  console.log(`Migration: Blob → R2  (delete-blobs: ${DELETE_BLOBS})`)
  const manifest = await readBlobManifest()
  console.log(`Manifest has ${manifest.data.length} photos`)

  let migrated = 0
  let skipped = 0
  const errors: string[] = []

  await pool(manifest.data, CONCURRENCY, async (photo, idx) => {
    try {
      const r = await migratePhoto(photo)
      if (r === 'migrated') migrated++
      else skipped++
      if ((idx + 1) % 20 === 0) console.log(`  …${idx + 1}/${manifest.data.length}`)
    } catch (e) {
      errors.push(`${photo.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  console.log(`Copied: ${migrated}, already-on-R2: ${skipped}, errors: ${errors.length}`)
  if (errors.length) {
    console.error('ERRORS:\n' + errors.join('\n'))
    throw new Error('Migration had errors — manifest NOT written. Fix and re-run (idempotent).')
  }

  // Write the updated manifest to R2
  await uploadToR2(MANIFEST_KEY, Buffer.from(JSON.stringify(manifest)), 'application/json', { immutable: false })
  console.log('Wrote manifest.json to R2 ✅')

  if (DELETE_BLOBS) {
    const { del } = await import('@vercel/blob')
    console.log('Deleting source blobs…')
    // (Re-read original Blob URLs would be needed; safer to delete manually after verifying.)
    console.log('Note: --delete-blobs is a placeholder; verify R2 first, then purge Blob from the dashboard or a follow-up.')
    void del
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED ❌', e)
  process.exit(1)
})
```

> Note: `@vercel/blob` was removed from `apps/ssr` in Task 12, but it's still available at the **repo root** (root `package.json` / hoisted) for this script. If not, run `pnpm -w add -D @vercel/blob` before executing.

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-blob-to-r2.ts
git commit -m "feat: Blob→R2 migration script (idempotent)"
```

---

## Task 14: Run the migration & verify data

**Files:** none (operational)

- [ ] **Step 1: Ensure the Blob token is in `/.env`**

Add `BLOB_READ_WRITE_TOKEN=<your token>` to `/.env` (pull from Vercel: `npx vercel env pull .env.vercel --environment=production --token=$TOKEN` then copy the value, or paste from the Vercel dashboard). Required only for the migration.

- [ ] **Step 2: Run the migration**

Run: `pnpm tsx scripts/migrate-blob-to-r2.ts`
Expected: `Copied: N, already-on-R2: 0, errors: 0` then `Wrote manifest.json to R2 ✅`.

- [ ] **Step 3: Spot-check via the verify lens**

Run:
```bash
set -a; . ./.env; set +a
# manifest exists on R2 and references the public base
curl -s "$R2_PUBLIC_BASE_URL/manifest.json" | head -c 200; echo
```
Expected: JSON containing photo entries whose `thumbnailUrl`/`originalUrl` start with `$R2_PUBLIC_BASE_URL`.

- [ ] **Step 4: Re-run to confirm idempotency**

Run: `pnpm tsx scripts/migrate-blob-to-r2.ts`
Expected: `Copied: 0, already-on-R2: N, errors: 0`.

---

## Task 15: Deploy & cut over

**Files:** none (operational)

- [ ] **Step 1: Push the branch (auto preview deploy)**

```bash
git push
```
Expected: Vercel builds a Preview deployment for `feat/r2-storage-migration` (it has the Preview R2 env vars).

- [ ] **Step 2: Verify the Preview deployment**

Open the preview URL. Confirm: gallery thumbnails load (from `pub-….r2.dev`), opening a photo loads the original, the EXIF panel works, and OG image (`/api/og/photo/<id>`) renders. Log in to `/admin`, upload a test photo end-to-end, then delete it.

- [ ] **Step 3: Promote to production**

Merge to `main` (or `npx vercel promote` the preview). Vercel deploys production. Re-verify `https://pics.andypandy.org` loads images from R2.

- [ ] **Step 4: Post-cutover cleanup (after confirming production is healthy)**

- Delete old Blob objects (Vercel dashboard → Storage → Blob, or a follow-up script).
- Remove `BLOB_READ_WRITE_TOKEN` from Vercel (`npx vercel env rm BLOB_READ_WRITE_TOKEN production` ×envs) and from `/.env`.
- **Rotate the R2 API keys** (they were shared in chat): create a new R2 token, update `/.env` + Vercel, delete the old token.
- Delete the temporary Vercel access token.

---

## Self-review checklist (completed by author)

- **Spec coverage:** storage lib (T2), manifest→R2 (T3), env (T4), presigned upload (T6/T7), process→R2 (T8), delete/exif (T9/T10), recover/scan (T11), drop Blob (T11/T12), migration (T13/T14), cutover (T15), CORS (done by user), public serving (verified). OG routes need no change (covered in spec, confirmed). ✅
- **Placeholders:** the `--delete-blobs` branch is intentionally a no-op with an explicit log (deleting source blobs is deferred to manual/verified cleanup in T15) — not a hidden TODO. ✅
- **Type consistency:** `uploadToR2(key,data,contentType,opts)`, `getFromR2(key)→Buffer|null`, `deleteFromR2(key)`, `deleteFromR2ByUrl(url)`, `listR2(prefix)→R2Object[]`, `presignPutUrl(key,exp)`, `publicUrl(key)`, `keyFromPublicUrl(url)` used consistently across T8–T13. Manifest fns `getManifest`/`getManifestSafe`/`saveManifest` keep their original signatures. ✅
