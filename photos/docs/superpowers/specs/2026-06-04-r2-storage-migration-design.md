# Design: Migrate photo storage from Vercel Blob to Cloudflare R2

**Date:** 2026-06-04
**Status:** Approved design → ready for implementation plan
**Author:** Andy (with Claude)

## Problem

The site (`apps/ssr`, Next.js on Vercel) stores every photo's original + thumbnail in
**Vercel Blob**, with a `manifest.json` index also in Blob. Blob has run out of space and
is expensive to scale. Goal: move all photo storage off Vercel Blob onto cheaper, larger
storage, and stop paying for Blob entirely.

## Decision

Use **Cloudflare R2** as the single storage backend for everything (originals, thumbnails,
and `manifest.json`). Vercel Blob is fully retired — no Blob token needed after migration.

### Why R2 (and not the originally-requested WebDAV)
The original request named `dav.mypikpak.com` (WebDAV). **Verified that PikPak's WebDAV is
read-only**: `PUT` returns a fake `200` but the bytes are silently discarded (`GET` returns
empty, `HEAD` → `403`, `PROPFIND` never lists the file; privilege set is `<D:read/>` only).
It is a streaming gateway for content already in the PikPak account, not a writable store.
So WebDAV-to-PikPak is impossible. R2 was chosen instead:

- **Zero egress fees** — image bandwidth is the cost driver for a gallery.
- **Public bucket URLs** — the browser loads images directly (no proxy, no extra Vercel
  bandwidth), exactly like Blob worked. Frontend needs no changes.
- **S3-compatible** — the codebase already speaks S3 (builder has a SigV4 client).
- Generous free tier; cheap beyond it.

### Verified facts (probed live)
- R2 signed S3 ops work with region `auto`: `PUT`/`GET`/`HEAD`/`DELETE` round-trip cleanly.
- Public serving via `https://pub-….r2.dev/<key>` works with **no auth** (`200` + correct body).
- Bucket: `afilmory-photos`, account `476c31abcb31e9804168b35f0fa2dce2`.

## Decisions locked with the user
1. **Backend:** Cloudflare R2 (already provisioned).
2. **Drop Blob entirely**, including `manifest.json` → R2.
3. **Public serving:** start on the `r2.dev` public dev URL
   (`https://pub-6d332a2be65d4bd2bb00662bba9cb4b0.r2.dev`); custom domain is a later
   env-only swap.
4. **Uploads:** presigned `PUT` direct from browser → R2 (no Blob staging; avoids Vercel's
   ~4.5 MB function request-body limit on 50 MB originals).
5. **Existing photos:** migrate from Blob → R2 (one-time, idempotent script).

## Architecture

Two base URLs:
- **`R2_S3_ENDPOINT`** = `https://<account>.r2.cloudflarestorage.com` — signed server ops
  (read/write `manifest.json`, presign uploads, upload thumbnails, delete objects).
- **`R2_PUBLIC_BASE_URL`** = the `r2.dev` URL (later a custom domain) — public image URLs
  stored in the manifest; browser loads these directly (cached, zero egress).

Key scheme (unchanged from today):
- Originals: `photos/original/<id>.<ext>`
- Thumbnails: `photos/thumb/<id>.webp`
- Index: `manifest.json`

**Manifest reads** use the *signed S3 endpoint* with `no-store` (always fresh — preserves the
existing stale-read fix), **not** the cached public domain. The manifest is never fetched
directly by the browser; it's injected into the page as `window.__MANIFEST__`, as today.

**S3 client:** add [`aws4fetch`](https://github.com/mhart/aws4fetch) to `apps/ssr` (tiny,
zero-dep, R2-standard). It does both header signing (server ops) and query signing
(presigned upload URLs). The builder's existing SigV4 client only does header signing, so it
can't generate the presigned URLs the browser upload needs.

## Components to change (all in `apps/ssr`)

1. **`src/lib/storage.ts`** (new; replaces `src/lib/blob.ts`). Exposes:
   - `getManifest()` / `getManifestSafe()` / `saveManifest()` — now R2-backed (same signatures).
   - `uploadToR2(key, buf, contentType, { immutable })`, `deleteFromR2(key)`, `listR2(prefix)`.
   - `presignPutUrl(key, contentType, expiresInSeconds)` — for browser direct upload.
   - `publicUrl(key)` → `${R2_PUBLIC_BASE_URL}/${key}`.
   - `keyFromPublicUrl(url)` — extract key from a stored public URL (for delete/exif-write).
   Uploaded image objects get `Cache-Control: public, max-age=31536000, immutable`.

2. **`src/env.ts`** — add `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` (and derived `R2_S3_ENDPOINT`). Remove
   `BLOB_READ_WRITE_TOKEN`.

3. **`src/app/api/admin/photos/upload/route.ts`** — replace Blob `handleUpload` with a handler
   that, given `{ filename, contentType }`, derives a key `photos/original/<id>.<ext>` and
   returns `{ id, key, uploadUrl }` (presigned PUT, ~10 min TTL). Admin-auth'd.

4. **`src/app/admin/(protected)/upload/page.tsx`** (client) — new flow per file:
   request presigned URL → `PUT` file to R2 with its `Content-Type` → `POST /process` with
   `{ id, key, filename, tags }`.

5. **`src/app/api/admin/photos/process/route.ts`** — read original from R2 (signed GET by key),
   generate thumbnail + thumbhash + EXIF (unchanged logic), upload thumbnail to R2, build the
   manifest item with **public** URLs (`publicUrl(originalKey)` / `publicUrl(thumbKey)`), save
   manifest to R2. Remove Blob staging/delete. The `recover` / `cleanup` / `fix-thumbhash`
   sub-actions get re-pointed to R2 (`listR2`, R2 URLs).

6. **`src/app/api/admin/photos/[id]/route.ts`** — `DELETE` removes the two R2 objects by key;
   `writeExifToImage` downloads from R2 and re-uploads to R2 (by `s3Key`).

7. **`src/app/api/admin/photos/bulk-delete/route.ts`** — delete from R2 by key.

8. **`src/app/api/admin/scan/route.ts`** + **`recover/route.ts`** — re-point Blob listing/URLs
   to R2 (`listR2`). Lower priority (recovery tooling) but cheap since they share `storage.ts`.

9. **OG routes** (`api/og/**`, `lib/og-helpers.tsx`) — **no change**; manifest holds absolute
   public R2 URLs, which Satori fetches directly (same as Blob today).

`apps/web` (frontend) needs **no changes** — `photo.thumbnailUrl` / `photo.originalUrl` simply
point at R2 instead of Blob.

## Data flows

- **Upload:** browser → `POST /api/admin/photos/upload` → `{ uploadUrl }` → browser `PUT`s
  original to R2 → `POST /api/admin/photos/process` → server reads original from R2, writes
  thumbnail to R2, updates `manifest.json` on R2.
- **View:** SSR reads `manifest.json` from R2 (signed, fresh) → injects `window.__MANIFEST__`
  → browser loads images from the public R2 URL (cached).
- **Delete:** remove manifest entry → save manifest → delete the two R2 objects.

## Environment variables

Local (git-ignored `/.env`, already created) and Vercel project env (Production + Preview):

```
R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_PUBLIC_BASE_URL  (+ R2_S3_ENDPOINT derived from account id)
```

Remove `BLOB_READ_WRITE_TOKEN` once cutover is verified.

## CORS (one-time, on the bucket)

Allows browser `PUT` (presigned upload) and cross-origin `GET` (EXIF viewer / download
buttons that `fetch()` the image):

```json
[{ "AllowedOrigins": ["https://pics.andypandy.org", "http://localhost:1924"],
   "AllowedMethods": ["GET", "PUT", "HEAD"],
   "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
```

## Migration — `scripts/migrate-blob-to-r2.ts`

One-time, run locally with both Blob token and R2 creds in `/.env`. The script is
**standalone** — it reads Blob via `@vercel/blob` directly (not via the app's storage lib,
which by then points at R2) and writes to R2 via the same signing approach as `storage.ts`:
1. Read the current manifest from Blob (`head()` + fetch of the manifest blob).
2. For each photo, if its URLs don't already point at R2:
   - download original from `originalUrl` and thumbnail from `thumbnailUrl` (Blob public URLs),
   - `PUT` both to R2 at `s3Key` and `photos/thumb/<id>.webp` (with immutable cache header),
   - rewrite `originalUrl` / `thumbnailUrl` to `publicUrl(key)`.
3. Write the updated `manifest.json` to R2.
4. **Idempotent / resumable** (skips already-migrated photos), concurrency-limited.
5. Optional `--delete-blobs` flag to purge Blob **after** verification.

## Cutover sequence
1. Set R2 env vars (local + Vercel) and the bucket CORS rule.
2. Implement the code changes above.
3. Run the migration script locally → R2 now holds all images + `manifest.json`.
4. Deploy. The app reads the manifest from R2 and serves images from the public R2 URL.
5. Verify: gallery loads, a new upload works end-to-end, delete works, OG images render.
6. Later: delete Blob data, remove `BLOB_READ_WRITE_TOKEN`, **rotate the R2 keys** (they were
   shared in chat).

## Testing / verification
- Storage round-trip already probed live (PUT/GET/HEAD/public-GET/DELETE all pass).
- During implementation: verify presigned `PUT` from a browser succeeds with CORS; verify a
  full upload→process→view cycle on `localhost:1924`; verify delete removes R2 objects.
- Post-deploy: spot-check several migrated photos load from the public R2 URL.

## Out of scope
- The **builder** (`packages/builder`, the offline CLI that reads *source* photos from S3) is
  unchanged — it's a separate workflow from the live admin-upload path.
- Custom domain for public serving — deferred; later swap of `R2_PUBLIC_BASE_URL` + a one-line
  manifest URL rewrite.

## Risks / notes
- **r2.dev limits:** rate-limited and flagged non-production by Cloudflare. Acceptable to launch
  on; custom domain upgrade is trivial later.
- **Exposed credentials:** the R2 access key/secret were shared in chat — rotate after cutover.
- **Original `Content-Type`:** browser `file.type` can be empty for HEIC; presign sets a
  best-effort type. Thumbnails (WebP, the displayed asset) are always correct, so low risk.
