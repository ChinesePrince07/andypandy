import type { NextRequest } from 'next/server'

import { rgbaToThumbHash } from 'thumbhash'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

import { reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'
import { listR2, uploadToR2 } from '~/lib/r2'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function rebuildCameras(photos: PhotoManifestItem[]): CameraInfo[] {
  const seen = new Map<string, CameraInfo>()
  for (const photo of photos) {
    const make = photo.exif?.Make
    const model = photo.exif?.Model
    if (make && model) {
      const key = `${make}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, { make, model, displayName: `${make} ${model}` })
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
        seen.set(key, { make: make || undefined, model, displayName: make ? `${make} ${model}` : model })
      }
    }
  }
  return Array.from(seen.values())
}

/**
 * POST /api/admin/recover
 * Scans Vercel Blob storage for original photo files and rebuilds the manifest.
 * This recovers photos whose manifest entries were lost.
 */
export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }))

    // Get current manifest to preserve albums and existing photos
    const manifest = await getManifest()
    const existingIds = new Set(manifest.data.map((p) => p.id))

    // Scan blob storage for original photos
    const allBlobs = await listR2()

    // Find original photo blobs (uploaded via the process route as photos/original/{id}.{ext}
    // or directly via client upload)
    const originalBlobs = allBlobs.filter(
      (b) =>
        !b.pathname.startsWith('photos/thumb/') &&
        b.pathname !== 'manifest.json' &&
        b.contentType?.startsWith('image/'),
    )

    // Find thumbnail blobs
    const thumbBlobs = new Map(
      allBlobs.filter((b) => b.pathname.startsWith('photos/thumb/')).map((b) => [b.pathname, b]),
    )

    const recovered: PhotoManifestItem[] = []
    const errors: string[] = []

    for (const blob of originalBlobs) {
      // Extract ID from pathname (e.g., "photos/original/abc123.jpg" -> "abc123")
      const match = blob.pathname.match(/(?:photos\/original\/)?([^/.]+)\.(\w+)$/)
      if (!match) continue

      const id = match[1]
      const ext = match[2]

      // Skip if already in manifest
      if (existingIds.has(id)) continue

      if (dryRun) {
        recovered.push({
          id,
          title: blob.pathname,
          description: '',
          dateTaken: blob.uploadedAt.toString(),
          tags: [],
          originalUrl: blob.url,
          thumbnailUrl: '',
          ogImageUrl: null,
          thumbHash: null,
          width: 0,
          height: 0,
          aspectRatio: 1,
          s3Key: blob.pathname,
          format: ext,
          size: blob.size,
          lastModified: blob.uploadedAt.toString(),
          exif: null,
          toneAnalysis: null,
          location: null,
          isHDR: false,
        })
        continue
      }

      // Full recovery: download, process, and rebuild entry
      try {
        const res = await fetch(blob.url)
        if (!res.ok) {
          errors.push(`Failed to download ${blob.pathname}: ${res.status}`)
          continue
        }
        const buffer = Buffer.from(await res.arrayBuffer())

        const sharp = (await import('sharp')).default
        const image = sharp(buffer).rotate()
        const metadata = await image.metadata()

        let fullWidth = metadata.width || 0
        let fullHeight = metadata.height || 0
        const orientation = metadata.orientation
        if (orientation && orientation >= 5 && orientation <= 8) {
          ;[fullWidth, fullHeight] = [fullHeight, fullWidth]
        }

        // Check if thumbnail already exists
        const thumbKey = `photos/thumb/${id}.webp`
        let thumbnailUrl = thumbBlobs.get(thumbKey)?.url || ''

        if (!thumbnailUrl) {
          // Generate thumbnail
          const { data: thumbnailBuffer } = await image
            .clone()
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer({ resolveWithObject: true })
          thumbnailUrl = await uploadToR2(thumbKey, thumbnailBuffer, 'image/webp')
        }

        // Generate thumbhash
        const { data, info } = await sharp(buffer)
          .rotate()
          .resize({ width: 100, height: 100, fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const thumbHashArray = rgbaToThumbHash(info.width, info.height, data)
        const thumbHashHex = Array.from(thumbHashArray)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')

        // Extract EXIF
        const exifr = (await import('exifr')).default
        let exifData: Record<string, any> | null = null
        let gpsDecimal: { latitude: number; longitude: number } | null = null
        try {
          exifData = await exifr.parse(buffer, {
            pick: [
              'Make',
              'Model',
              'LensModel',
              'LensMake',
              'FocalLength',
              'FocalLengthIn35mmFormat',
              'FNumber',
              'ISO',
              'ExposureTime',
              'ExposureCompensation',
              'WhiteBalance',
              'DateTimeOriginal',
              'CreateDate',
              'Flash',
              'MeteringMode',
              'ColorSpace',
              'ImageWidth',
              'ImageHeight',
              'Orientation',
            ],
          })
          const gps = await exifr.gps(buffer)
          if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
            gpsDecimal = { latitude: gps.latitude, longitude: gps.longitude }
          }
        } catch {
          // EXIF parsing can fail
        }

        const pickedExif: PickedExif | null = exifData
          ? ({
              Make: exifData.Make || undefined,
              Model: exifData.Model || undefined,
              LensModel: exifData.LensModel || undefined,
              LensMake: exifData.LensMake || undefined,
              FocalLength: exifData.FocalLength ? `${exifData.FocalLength}mm` : undefined,
              FocalLengthIn35mmFormat: exifData.FocalLengthIn35mmFormat
                ? `${exifData.FocalLengthIn35mmFormat}mm`
                : undefined,
              FNumber: exifData.FNumber || undefined,
              ISO: exifData.ISO || undefined,
              ExposureTime: exifData.ExposureTime || undefined,
              ExposureCompensation: exifData.ExposureCompensation ?? undefined,
              WhiteBalance: exifData.WhiteBalance || undefined,
              Flash: exifData.Flash || undefined,
              MeteringMode: exifData.MeteringMode || undefined,
              ColorSpace: exifData.ColorSpace || undefined,
              ImageWidth: exifData.ImageWidth || fullWidth || undefined,
              ImageHeight: exifData.ImageHeight || fullHeight || undefined,
              Orientation: exifData.Orientation || undefined,
              GPSLatitude: gpsDecimal?.latitude,
              GPSLongitude: gpsDecimal?.longitude,
              GPSAltitude: exifData.GPSAltitude || undefined,
              DateTimeOriginal: exifData.DateTimeOriginal
                ? exifData.DateTimeOriginal instanceof Date
                  ? exifData.DateTimeOriginal.toISOString()
                  : String(exifData.DateTimeOriginal)
                : undefined,
            } as PickedExif)
          : null

        let dateTaken: string | null = null
        if (exifData?.DateTimeOriginal) {
          dateTaken =
            exifData.DateTimeOriginal instanceof Date
              ? exifData.DateTimeOriginal.toISOString()
              : String(exifData.DateTimeOriginal)
        } else if (exifData?.CreateDate) {
          dateTaken =
            exifData.CreateDate instanceof Date ? exifData.CreateDate.toISOString() : String(exifData.CreateDate)
        }

        let gpsData: LocationInfo | null = null
        if (gpsDecimal) {
          const geo = await reverseGeocode(gpsDecimal.latitude, gpsDecimal.longitude)
          gpsData = {
            latitude: gpsDecimal.latitude,
            longitude: gpsDecimal.longitude,
            country: geo.country || undefined,
            city: geo.city || undefined,
            locationName: geo.locationName || undefined,
          }
        }

        const photoItem: PhotoManifestItem = {
          id,
          title:
            blob.pathname
              .split('/')
              .pop()
              ?.replace(/\.\w+$/, '') || id,
          description: '',
          dateTaken: dateTaken || blob.uploadedAt.toString(),
          tags: [],
          originalUrl: blob.url,
          thumbnailUrl,
          ogImageUrl: null,
          thumbHash: thumbHashHex,
          width: fullWidth,
          height: fullHeight,
          aspectRatio: fullWidth && fullHeight ? fullWidth / fullHeight : 1,
          s3Key: blob.pathname,
          format: metadata.format || ext,
          size: buffer.length,
          lastModified: new Date().toISOString(),
          exif: pickedExif,
          toneAnalysis: null,
          location: gpsData,
          isHDR: false,
        }

        recovered.push(photoItem)
        existingIds.add(id)
      } catch (error) {
        errors.push(`Failed to process ${blob.pathname}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (!dryRun && recovered.length > 0) {
      manifest.data.push(...recovered)
      manifest.data.sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())
      manifest.cameras = rebuildCameras(manifest.data)
      manifest.lenses = rebuildLenses(manifest.data)
      await saveManifest(manifest)
    }

    return Response.json({
      dryRun,
      totalBlobsScanned: allBlobs.length,
      originalPhotosFound: originalBlobs.length,
      alreadyInManifest: existingIds.size - recovered.length,
      recovered: recovered.length,
      errors,
      recoveredPhotos: recovered.map((p) => ({ id: p.id, pathname: p.s3Key, url: p.originalUrl })),
    })
  } catch (error) {
    console.error('Recovery error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Recovery failed' }, { status: 500 })
  }
}
