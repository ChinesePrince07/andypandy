import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST() {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const exifr = (await import('exifr')).default
  const manifest = await getManifest()
  let fixed = 0
  let failed = 0
  const details: { id: string; status: string; lat?: number; lng?: number }[] = []

  for (const photo of manifest.data) {
    if (!photo.originalUrl) continue

    try {
      // Try partial fetch first, fall back to full image
      let buffer: Buffer
      try {
        const res = await fetch(photo.originalUrl, {
          headers: { Range: 'bytes=0-131071' },
        })
        buffer = Buffer.from(await res.arrayBuffer())
      } catch {
        const res = await fetch(photo.originalUrl)
        buffer = Buffer.from(await res.arrayBuffer())
      }

      // Use exifr.gps() for proper decimal conversion with hemisphere handling
      let gps: { latitude: number; longitude: number } | null = null
      try {
        gps = await exifr.gps(buffer)
      } catch {
        // Partial buffer might fail, try full image
        const fullRes = await fetch(photo.originalUrl)
        const fullBuffer = Buffer.from(await fullRes.arrayBuffer())
        gps = await exifr.gps(fullBuffer)
      }

      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        // Update location
        photo.location = {
          latitude: gps.latitude,
          longitude: gps.longitude,
        }

        // Update EXIF GPS fields to decimal (remove DMS arrays)
        if (photo.exif) {
          ;(photo.exif as Record<string, unknown>).GPSLatitude = gps.latitude
          ;(photo.exif as Record<string, unknown>).GPSLongitude = gps.longitude
          // Remove raw ref fields — decimal values are already signed
          delete (photo.exif as Record<string, unknown>).GPSLatitudeRef
          delete (photo.exif as Record<string, unknown>).GPSLongitudeRef
        }

        fixed++
        details.push({ id: photo.id, status: 'fixed', lat: gps.latitude, lng: gps.longitude })
      } else {
        // No GPS in image
        photo.location = null
        if (photo.exif) {
          delete (photo.exif as Record<string, unknown>).GPSLatitude
          delete (photo.exif as Record<string, unknown>).GPSLongitude
        }
        details.push({ id: photo.id, status: 'no-gps' })
      }
    } catch {
      // Image has no extractable GPS — clean up
      photo.location = null
      if (photo.exif) {
        delete (photo.exif as Record<string, unknown>).GPSLatitude
        delete (photo.exif as Record<string, unknown>).GPSLongitude
        delete (photo.exif as Record<string, unknown>).GPSLatitudeRef
        delete (photo.exif as Record<string, unknown>).GPSLongitudeRef
      }
      failed++
      details.push({ id: photo.id, status: 'no-gps-fallback' })
    }
  }

  await saveManifest(manifest)

  return Response.json({ fixed, failed, total: manifest.data.length, details })
}
