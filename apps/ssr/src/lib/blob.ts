import { del, head, list, put } from '@vercel/blob'
import type { AfilmoryManifest } from '@afilmory/typing'

const MANIFEST_KEY = 'manifest.json'

const EMPTY_MANIFEST: AfilmoryManifest = {
  version: 'v10',
  data: [],
  cameras: [],
  lenses: [],
  albums: [],
}

/**
 * Get the manifest from Vercel Blob storage.
 * Uses head() to get the downloadUrl which bypasses CDN cache, then fetches
 * the content directly. This avoids the stale reads caused by Vercel Blob's
 * default 1-month CDN cache, which was the root cause of lost photos.
 */
export async function getManifest(): Promise<AfilmoryManifest> {
  try {
    // head() returns fresh metadata including downloadUrl (not CDN-cached)
    const blobMeta = await head(MANIFEST_KEY, { token: process.env.BLOB_READ_WRITE_TOKEN! })
    // downloadUrl bypasses CDN — it's a token-authenticated direct URL
    const res = await fetch(blobMeta.downloadUrl, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Failed to fetch manifest: ${res.status} ${res.statusText}`)
    }
    const text = await res.text()
    const manifest: AfilmoryManifest = JSON.parse(text)
    console.log(`[getManifest] Loaded ${manifest.data.length} photos`)
    return manifest
  } catch (error: any) {
    // BlobNotFoundError means no manifest exists yet
    if (error?.name === 'BlobNotFoundError' || error?.code === 'blob_not_found') {
      return { ...EMPTY_MANIFEST, albums: [...EMPTY_MANIFEST.albums] }
    }
    throw error
  }
}

/**
 * Safe version of getManifest for read-only operations (SSR page rendering).
 * Returns EMPTY_MANIFEST on error instead of throwing, so the page still renders.
 */
export async function getManifestSafe(): Promise<AfilmoryManifest> {
  try {
    return await getManifest()
  } catch (error) {
    console.error('Failed to load manifest:', error)
    return { ...EMPTY_MANIFEST, albums: [...EMPTY_MANIFEST.albums] }
  }
}

export async function saveManifest(manifest: AfilmoryManifest): Promise<string> {
  const { url } = await put(MANIFEST_KEY, JSON.stringify(manifest), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60, // 1 minute — default is 1 month which causes stale reads
  })
  console.log(`[saveManifest] Saved manifest with ${manifest.data.length} photos to ${url}`)
  return url
}

export async function uploadToBlob(filename: string, data: Buffer, contentType: string): Promise<string> {
  const { url } = await put(filename, data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  })
  return url
}

export async function deleteFromBlob(url: string): Promise<void> {
  if (!url) {
    console.warn('[deleteFromBlob] Empty URL provided, skipping')
    return
  }
  console.log(`[deleteFromBlob] Calling del() with URL: ${url}`)
  await del(url)
  console.log(`[deleteFromBlob] del() completed for: ${url}`)
}

export async function listAllBlobs(prefix?: string) {
  const allBlobs: Awaited<ReturnType<typeof list>>['blobs'] = []
  let cursor: string | undefined
  do {
    const result = await list({ prefix, cursor, limit: 1000 })
    allBlobs.push(...result.blobs)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)
  return allBlobs
}
