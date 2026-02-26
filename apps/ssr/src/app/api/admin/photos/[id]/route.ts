import type { NextRequest } from 'next/server'

import type { CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/typing'

import { reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { deleteFromBlob, getManifest, saveManifest, uploadToBlob } from '~/lib/blob'

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

/**
 * Convert decimal degrees to EXIF GPS rational format: "D/1 M/1 S/100"
 */
function decimalToExifGps(decimal: number): string {
  const abs = Math.abs(decimal)
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = Math.round((mFloat - m) * 60 * 100)
  return `${d}/1 ${m}/1 ${s}/100`
}

/**
 * Format a Date object as EXIF datetime string: "YYYY:MM:DD HH:MM:SS"
 */
function toExifDateTime(date: Date): string {
  const y = date.getUTCFullYear()
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}:${mo}:${d} ${h}:${mi}:${s}`
}

/**
 * Write EXIF metadata back into the original image file using sharp.
 * Downloads the image, merges EXIF data, and re-uploads to the same blob path.
 */
async function writeExifToImage(photo: PhotoManifestItem): Promise<{ success: boolean; error?: string }> {
  try {
    const sharp = (await import('sharp')).default

    // Download original image
    const res = await fetch(photo.originalUrl)
    if (!res.ok) {
      return { success: false, error: `Failed to download original: ${res.status}` }
    }
    const buffer = Buffer.from(await res.arrayBuffer())

    // Build EXIF data to merge
    const ifd0: Record<string, string> = {}
    const exifIfd: Record<string, string> = {}
    const gpsIfd: Record<string, string> = {}

    // Camera info → IFD0
    if (photo.exif?.Make) ifd0.Make = photo.exif.Make
    if (photo.exif?.Model) ifd0.Model = photo.exif.Model
    if (photo.exif?.Software) ifd0.Software = photo.exif.Software
    if (photo.exif?.Artist) ifd0.Artist = photo.exif.Artist
    if (photo.exif?.Copyright) ifd0.Copyright = photo.exif.Copyright

    // Date → Exif IFD
    if (photo.dateTaken) {
      const dt = toExifDateTime(new Date(photo.dateTaken))
      exifIfd.DateTimeOriginal = dt
      exifIfd.DateTimeDigitized = dt
      ifd0.DateTime = dt
    }

    // Lens → Exif IFD
    if (photo.exif?.LensMake) exifIfd.LensMake = photo.exif.LensMake
    if (photo.exif?.LensModel) exifIfd.LensModel = photo.exif.LensModel
    if (photo.exif?.FocalLength) exifIfd.FocalLength = photo.exif.FocalLength
    if (photo.exif?.FNumber != null) exifIfd.FNumber = String(photo.exif.FNumber)
    if (photo.exif?.ISO != null) exifIfd.ISOSpeedRatings = String(photo.exif.ISO)
    if (photo.exif?.ExposureTime != null) exifIfd.ExposureTime = String(photo.exif.ExposureTime)

    // GPS coordinates
    const lat = photo.location?.latitude ?? photo.exif?.GPSLatitude
    const lng = photo.location?.longitude ?? photo.exif?.GPSLongitude
    if (lat != null && lng != null) {
      gpsIfd.GPSLatitudeRef = lat >= 0 ? 'N' : 'S'
      gpsIfd.GPSLatitude = decimalToExifGps(lat)
      gpsIfd.GPSLongitudeRef = lng >= 0 ? 'E' : 'W'
      gpsIfd.GPSLongitude = decimalToExifGps(lng)
    }

    // Build exif object for sharp
    const exifData: Record<string, Record<string, string>> = {}
    if (Object.keys(ifd0).length > 0) exifData.IFD0 = ifd0
    if (Object.keys(exifIfd).length > 0) exifData.IFD2 = exifIfd
    if (Object.keys(gpsIfd).length > 0) exifData.IFD3 = gpsIfd

    if (Object.keys(exifData).length === 0) {
      return { success: true } // Nothing to write
    }

    // Use withExifMerge to preserve existing EXIF while updating specific fields
    const outputBuffer = await sharp(buffer).keepMetadata().withExifMerge(exifData).toBuffer()

    // Re-upload to the same blob path
    const contentType =
      photo.format === 'jpeg' || photo.format === 'jpg'
        ? 'image/jpeg'
        : photo.format === 'png'
          ? 'image/png'
          : photo.format === 'webp'
            ? 'image/webp'
            : photo.format === 'tiff'
              ? 'image/tiff'
              : `image/${photo.format}`

    await uploadToBlob(photo.s3Key, outputBuffer, contentType)

    console.log(`[writeExif] Successfully wrote EXIF to ${photo.s3Key}`)
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[writeExif] Failed for ${photo.id}: ${msg}`)
    return { success: false, error: msg }
  }
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

  // Optionally write EXIF metadata back into the original image file
  let exifWriteResult: { success: boolean; error?: string } | undefined
  if (body.writeExif === true) {
    exifWriteResult = await writeExifToImage(photo)
  }

  return Response.json({
    ...photo,
    _exifWrite: exifWriteResult,
  })
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

  // Then delete blobs
  const blobErrors: string[] = []
  try {
    console.log(`[DELETE] Deleting original blob: ${photo.originalUrl}`)
    await deleteFromBlob(photo.originalUrl)
    console.log(`[DELETE] Successfully deleted original blob`)
  } catch (e) {
    const msg = `Failed to delete original blob ${photo.originalUrl}: ${e instanceof Error ? e.message : String(e)}`
    console.error(`[DELETE] ${msg}`)
    blobErrors.push(msg)
  }
  try {
    console.log(`[DELETE] Deleting thumbnail blob: ${photo.thumbnailUrl}`)
    await deleteFromBlob(photo.thumbnailUrl)
    console.log(`[DELETE] Successfully deleted thumbnail blob`)
  } catch (e) {
    const msg = `Failed to delete thumbnail blob ${photo.thumbnailUrl}: ${e instanceof Error ? e.message : String(e)}`
    console.error(`[DELETE] ${msg}`)
    blobErrors.push(msg)
  }

  return Response.json({ success: true, blobsDeleted: blobErrors.length === 0, blobErrors })
}
