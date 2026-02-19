import { del, list, put } from '@vercel/blob'
import type { AfilmoryManifest } from '@afilmory/typing'

const MANIFEST_KEY = 'manifest.json'

const EMPTY_MANIFEST: AfilmoryManifest = {
  version: 'v10',
  data: [],
  cameras: [],
  lenses: [],
}

export async function getManifest(): Promise<AfilmoryManifest> {
  const { blobs } = await list({ prefix: MANIFEST_KEY, limit: 1 })
  const blob = blobs.find((b) => b.pathname === MANIFEST_KEY)

  if (!blob) {
    return EMPTY_MANIFEST
  }

  const res = await fetch(blob.url)
  const manifest: AfilmoryManifest = await res.json()
  return manifest
}

export async function saveManifest(manifest: AfilmoryManifest): Promise<void> {
  await put(MANIFEST_KEY, JSON.stringify(manifest), {
    access: 'public',
    addRandomSuffix: false,
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
  await del(url)
}
