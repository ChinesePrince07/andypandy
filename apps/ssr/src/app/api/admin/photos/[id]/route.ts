import type { NextRequest } from 'next/server'

import type { CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/typing'

import { reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { deleteFromBlob, getManifest, saveManifest } from '~/lib/blob'

function rebuildCameras(photos: PhotoManifestItem[]): CameraInfo[] {
  const seen = new Map<string, CameraInfo>()
  for (const photo of photos) {
    const make = photo.exif?.Make
    const model = photo.exif?.Model
    if (make && model) {
      const key = `${make}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make,
          model,
          displayName: `${make} ${model}`,
        })
      }
    }
  }
  return Array.from(seen.values())
}

function rebuildLenses(photos: PhotoManifestItem[]): LensInfo[] {
  const seen = new Map<string, LensInfo>()
  for (const photo of photos) {
    const model = photo.exif?.LensModel
    if (model) {
      const make = photo.exif?.LensMake
      const key = `${make || ''}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make: make || undefined,
          model,
          displayName: make ? `${make} ${model}` : model,
        })
      }
    }
  }
  return Array.from(seen.values())
}

// GET — Get single photo metadata
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params
  const manifest = await getManifest()
  const photo = manifest.data.find((p) => p.id === id)

  if (!photo) {
    return Response.json({ error: 'Photo not found' }, { status: 404 })
  }

  return Response.json(photo)
}

// PATCH — Update photo metadata
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const manifest = await getManifest()
  const index = manifest.data.findIndex((p) => p.id === id)

  if (index === -1) {
    return Response.json({ error: 'Photo not found' }, { status: 404 })
  }

  const photo = manifest.data[index]

  // Update simple fields
  if (typeof body.title === 'string') photo.title = body.title
  if (typeof body.description === 'string') photo.description = body.description
  if (typeof body.dateTaken === 'string') photo.dateTaken = body.dateTaken
  if (Array.isArray(body.tags)) photo.tags = body.tags

  // Merge exif fields (don't replace entirely)
  if (body.exif && typeof body.exif === 'object') {
    const exifUpdates = body.exif as Record<string, unknown>
    if (!photo.exif) {
      photo.exif = {} as PhotoManifestItem['exif'] & object
    }
    Object.assign(photo.exif!, exifUpdates)
  }

  // Update location (lat/lng) with reverse geocoding
  if ('location' in body) {
    if (body.location === null) {
      photo.location = null
    } else if (typeof body.location === 'object' && body.location !== null) {
      const loc = body.location as { latitude?: number; longitude?: number }
      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        const geo = await reverseGeocode(loc.latitude, loc.longitude)
        photo.location = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          country: geo.country || undefined,
          city: geo.city || undefined,
          locationName: geo.locationName || undefined,
        }
      }
    }
  }

  manifest.data[index] = photo

  // Re-sort by dateTaken if date was changed (newest first)
  if (typeof body.dateTaken === 'string') {
    manifest.data.sort((a, b) => {
      const dateA = new Date(a.dateTaken).getTime()
      const dateB = new Date(b.dateTaken).getTime()
      return dateB - dateA
    })
  }

  // Recalculate cameras if make/model may have changed
  const exifUpdates = body.exif as Record<string, unknown> | undefined
  if (exifUpdates && ('Make' in exifUpdates || 'Model' in exifUpdates)) {
    manifest.cameras = rebuildCameras(manifest.data)
  }

  // Recalculate lenses if lens info may have changed
  if (exifUpdates && ('LensMake' in exifUpdates || 'LensModel' in exifUpdates)) {
    manifest.lenses = rebuildLenses(manifest.data)
  }

  await saveManifest(manifest)

  return Response.json(photo)
}

// DELETE — Delete a photo
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params
  const manifest = await getManifest()
  const index = manifest.data.findIndex((p) => p.id === id)

  if (index === -1) {
    return Response.json({ error: 'Photo not found' }, { status: 404 })
  }

  const photo = manifest.data[index]

  // Remove from manifest
  manifest.data.splice(index, 1)

  // Recalculate cameras and lenses
  manifest.cameras = rebuildCameras(manifest.data)
  manifest.lenses = rebuildLenses(manifest.data)

  // Save manifest FIRST so the photo is removed from gallery immediately,
  // even if blob cleanup fails afterwards
  await saveManifest(manifest)

  // Then delete blobs (best-effort cleanup)
  try {
    await deleteFromBlob(photo.originalUrl)
  } catch {
    // Original may already be gone, continue
  }
  try {
    await deleteFromBlob(photo.thumbnailUrl)
  } catch {
    // Thumbnail may already be gone, continue
  }

  return Response.json({ success: true })
}
