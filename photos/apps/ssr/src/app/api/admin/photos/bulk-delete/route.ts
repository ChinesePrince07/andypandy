import type { NextRequest } from 'next/server'

import type { PhotoManifestItem } from '@afilmory/typing'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'
import { rebuildCameras, rebuildLenses } from '~/lib/manifest-view'
import { deleteFromR2ByUrl } from '~/lib/r2'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Missing or empty ids array' }, { status: 400 })
    }

    const manifest = await getManifest()
    const idSet = new Set(ids as string[])
    const toDelete = manifest.data.filter((p) => idSet.has(p.id))
    manifest.data = manifest.data.filter((p) => !idSet.has(p.id))

    // Rebuild cameras/lenses
    manifest.cameras = rebuildCameras(manifest.data)
    manifest.lenses = rebuildLenses(manifest.data)

    // Save manifest FIRST so photos are removed from gallery immediately,
    // even if blob cleanup fails afterwards
    await saveManifest(manifest)

    // Then delete blobs
    const blobErrors: string[] = []
    for (const photo of toDelete) {
      try {
        await deleteFromR2ByUrl(photo.originalUrl)
      } catch (e) {
        const msg = `Failed to delete original ${photo.originalUrl}: ${e instanceof Error ? e.message : String(e)}`
        console.error(`[BULK-DELETE] ${msg}`)
        blobErrors.push(msg)
      }
      try {
        await deleteFromR2ByUrl(photo.thumbnailUrl)
      } catch (e) {
        const msg = `Failed to delete thumbnail ${photo.thumbnailUrl}: ${e instanceof Error ? e.message : String(e)}`
        console.error(`[BULK-DELETE] ${msg}`)
        blobErrors.push(msg)
      }
    }

    return Response.json({ deleted: toDelete.length, blobsDeleted: blobErrors.length === 0, blobErrors })
  } catch (error) {
    console.error('Bulk delete error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Bulk delete failed' }, { status: 500 })
  }
}
