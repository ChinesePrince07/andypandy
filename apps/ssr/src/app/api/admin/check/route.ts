import type { NextRequest } from 'next/server'

import { rgbaToThumbHash } from 'thumbhash'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

import { reverseGeocode } from '~/lib/ai'
import { requireAdmin, verifyAdmin } from '~/lib/admin-auth'
import { getManifest, listAllBlobs, saveManifest, uploadToBlob } from '~/lib/blob'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const authenticated = await verifyAdmin()
  return Response.json({ authenticated })
}

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
 * POST /api/admin/check — Recovery endpoint
 * Scans Vercel Blob storage for orphaned photo files and rebuilds manifest entries.
 */
export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }))

    const manifest = await getManifest()
    const existingIds = new Set(manifest.data.map((p) => p.id))

    const allBlobs = await listAllBlobs()

    const originalBlobs = allBlobs.filter(
      (b) =>
        !b.pathname.startsWith('photos/thumb/') &&
        b.pathname !== 'manifest.json' &&
        b.contentType?.startsWith('image/'),
    )

    const thumbBlobs = new Map(
      allBlobs.filter((b) => b.pathname.startsWith('photos/thumb/')).map((b) => [b.pathname, b]),
    )

    const recovered: PhotoManifestItem[] = []
    const errors: string[] = []

    for (const blob of originalBlobs) {
      const match = blob.pathname.match(/(?:photos\/original\/)?([^/.]+)\.(\w+)$/)
      if (!match) continue

      const id = match[1]
      const ext = match[2]

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

        const thumbKey = `photos/thumb/${id}.webp`
        let thumbnailUrl = thumbBlobs.get(thumbKey)?.url || ''

        if (!thumbnailUrl) {
          const { data: thumbnailBuffer } = await image
            .clone()
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer({ resolveWithObject: true })
          thumbnailUrl = await uploadToBlob(thumbKey, thumbnailBuffer, 'image/webp')
        }

        const { data, info } = await sharp(buffer)
          .rotate()
          .resize({ width: 100, height: 100, fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const thumbHashArray = rgbaToThumbHash(info.width, info.height, data)
        const thumbHashBase64 = Buffer.from(thumbHashArray).toString('base64')

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
              GPSLatitude: gpsDecimal?.latitude,
              GPSLongitude: gpsDecimal?.longitude,
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
          thumbHash: thumbHashBase64,
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
