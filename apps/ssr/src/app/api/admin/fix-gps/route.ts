import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/blob'

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
      // Fetch only the first 64KB — enough for EXIF headers
      const res = await fetch(photo.originalUrl, {
        headers: { Range: 'bytes=0-65535' },
      })
      const buffer = Buffer.from(await res.arrayBuffer())

      // Use exifr.gps() for proper decimal conversion with hemisphere handling
      const gps = await exifr.gps(buffer)

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
    } catch (err) {
      failed++
      details.push({ id: photo.id, status: 'error', lat: undefined, lng: undefined })
    }
  }

  await saveManifest(manifest)

  return Response.json({ fixed, failed, total: manifest.data.length, details })
}
