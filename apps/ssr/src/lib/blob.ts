import { del, list, put } from '@vercel/blob'
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
 * Returns the manifest if found, or EMPTY_MANIFEST if no manifest exists yet.
 * Throws on network/auth errors to prevent write operations from accidentally
 * saving an empty manifest and wiping existing data.
 */
export async function getManifest(): Promise<AfilmoryManifest> {
  const { blobs } = await list({ prefix: MANIFEST_KEY, limit: 1 })
  const blob = blobs.find((b) => b.pathname === MANIFEST_KEY)

  if (!blob) {
    return { ...EMPTY_MANIFEST, albums: [...EMPTY_MANIFEST.albums] }
  }

  // Add cache-busting param to bypass CDN edge caches
  const bustUrl = `${blob.url}${blob.url.includes('?') ? '&' : '?'}t=${Date.now()}`
  const res = await fetch(bustUrl, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest blob: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  const manifest: AfilmoryManifest = JSON.parse(text)
  return manifest
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

export async function saveManifest(manifest: AfilmoryManifest): Promise<void> {
  await put(MANIFEST_KEY, JSON.stringify(manifest), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

export async function uploadToBlob(filename: string, data: Buffer, contentType: string): Promise<string> {
  const { url } = await put(filename, data, {
    access: 'public',
    addRandomSuffix: false,
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
