import 'dotenv/config'

import { del, head } from '@vercel/blob'

import type { AfilmoryManifest, PhotoManifestItem } from '@afilmory/typing'

import { publicUrl, uploadToR2 } from '../apps/ssr/src/lib/r2'

const MANIFEST_KEY = 'manifest.json'
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
const DRY_RUN = process.argv.includes('--dry-run')
const DELETE_BLOBS = process.argv.includes('--delete-blobs')
const CONCURRENCY = 6

const CT_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
}

function contentTypeForKey(key: string, fallback = 'application/octet-stream'): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return CT_BY_EXT[ext] ?? fallback
}

async function readBlobManifest(): Promise<AfilmoryManifest> {
  if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required to read the source manifest from Blob')
  const meta = await head(MANIFEST_KEY, { token: BLOB_TOKEN })
  const res = await fetch(meta.downloadUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch manifest from Blob: ${res.status}`)
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

interface MigrateResult {
  status: 'skipped' | 'migrated' | 'would-migrate'
  oldBlobUrls: string[]
}

async function migratePhoto(photo: PhotoManifestItem): Promise<MigrateResult> {
  const oldBlobUrls: string[] = []
  if (alreadyOnR2(photo.originalUrl) && alreadyOnR2(photo.thumbnailUrl)) {
    return { status: 'skipped', oldBlobUrls }
  }
  if (DRY_RUN) return { status: 'would-migrate', oldBlobUrls }

  const originalKey = photo.s3Key || `photos/original/${photo.id}`
  const thumbKey = `photos/thumb/${photo.id}.webp`

  if (!alreadyOnR2(photo.originalUrl) && photo.originalUrl) {
    const buf = await download(photo.originalUrl)
    await uploadToR2(originalKey, buf, contentTypeForKey(originalKey, `image/${photo.format || 'jpeg'}`))
    oldBlobUrls.push(photo.originalUrl)
    photo.originalUrl = publicUrl(originalKey)
    photo.s3Key = originalKey
  }
  if (!alreadyOnR2(photo.thumbnailUrl) && photo.thumbnailUrl) {
    const buf = await download(photo.thumbnailUrl)
    await uploadToR2(thumbKey, buf, 'image/webp')
    oldBlobUrls.push(photo.thumbnailUrl)
    photo.thumbnailUrl = publicUrl(thumbKey)
  }
  return { status: 'migrated', oldBlobUrls }
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
  console.log(`Migration: Blob → R2  (dry-run: ${DRY_RUN}, delete-blobs: ${DELETE_BLOBS})`)
  if (!PUBLIC_BASE) throw new Error('R2_PUBLIC_BASE_URL is not set')

  const manifest = await readBlobManifest()
  console.log(`Source manifest has ${manifest.data.length} photos`)

  let migrated = 0
  let skipped = 0
  const errors: string[] = []
  const blobsToDelete: string[] = []

  await pool(manifest.data, CONCURRENCY, async (photo, idx) => {
    try {
      const r = await migratePhoto(photo)
      if (r.status === 'skipped') skipped++
      else migrated++
      blobsToDelete.push(...r.oldBlobUrls)
      if ((idx + 1) % 20 === 0) console.log(`  …${idx + 1}/${manifest.data.length}`)
    } catch (e) {
      errors.push(`${photo.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  const verb = DRY_RUN ? 'would copy' : 'copied'
  console.log(`${verb}: ${migrated}, already-on-R2: ${skipped}, errors: ${errors.length}`)
  if (errors.length) {
    console.error(`ERRORS:\n${errors.join('\n')}`)
    throw new Error('Migration had errors — manifest NOT written. Fix and re-run (idempotent).')
  }

  if (DRY_RUN) {
    console.log('Dry run complete — no data written.')
    return
  }

  await uploadToR2(MANIFEST_KEY, Buffer.from(JSON.stringify(manifest)), 'application/json', { immutable: false })
  console.log('Wrote manifest.json to R2 ✅')

  if (DELETE_BLOBS && blobsToDelete.length > 0) {
    if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN required to delete blobs')
    console.log(`Deleting ${blobsToDelete.length} source blobs from Vercel Blob…`)
    await pool(blobsToDelete, CONCURRENCY, async (url) => {
      try {
        await del(url, { token: BLOB_TOKEN })
      } catch (e) {
        console.warn(`  failed to delete ${url}: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
    console.log('Source blobs deleted.')
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED ❌', e)
  process.exit(1)
})
