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
