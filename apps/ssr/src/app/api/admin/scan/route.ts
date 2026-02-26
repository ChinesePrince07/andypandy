import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, listAllBlobs, saveManifest, uploadToBlob } from '~/lib/blob'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun !== false

    const manifest = await getManifest()
    const existingIds = new Set(manifest.data.map((p: PhotoManifestItem) => p.id))

    const allBlobs = await listAllBlobs()

    const originalBlobs = allBlobs.filter(
      (b: any) =>
        !b.pathname.startsWith('photos/thumb/') &&
        b.pathname !== 'manifest.json' &&
        b.contentType?.startsWith('image/'),
    )

    const thumbBlobs = new Map(
      allBlobs.filter((b: any) => b.pathname.startsWith('photos/thumb/')).map((b: any) => [b.pathname, b]),
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
          const thumbResult = await image
            .clone()
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer({ resolveWithObject: true })
          thumbnailUrl = await uploadToBlob(thumbKey, thumbResult.data, 'image/webp')
        }

        const { rgbaToThumbHash } = await import('thumbhash')
        const thumbData = await sharp(buffer)
          .rotate()
          .resize({ width: 100, height: 100, fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const thumbHashArray = rgbaToThumbHash(thumbData.info.width, thumbData.info.height, thumbData.data)
        const thumbHashBase64 = Buffer.from(thumbHashArray).toString('base64')

        const exifr = (await import('exifr')).default
        let exifData: Record<string, any> | null = null
        let gpsDecimal: { latitude: number; longitude: number } | null = null
        try {
          exifData = await exifr.parse(buffer, {
            pick: [
              'Make', 'Model', 'LensModel', 'LensMake', 'FocalLength',
              'FocalLengthIn35mmFormat', 'FNumber', 'ISO', 'ExposureTime',
              'ExposureCompensation', 'WhiteBalance', 'DateTimeOriginal',
              'CreateDate', 'Flash', 'MeteringMode', 'ColorSpace',
              'ImageWidth', 'ImageHeight', 'Orientation',
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
          const { reverseGeocode } = await import('~/lib/ai')
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
          title: blob.pathname.split('/').pop()?.replace(/\.\w+$/, '') || id,
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
      manifest.data.sort((a: PhotoManifestItem, b: PhotoManifestItem) =>
        new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
      )

      const camerasSeen = new Map<string, CameraInfo>()
      for (const photo of manifest.data) {
        const make = photo.exif?.Make
        const model = photo.exif?.Model
        if (make && model) {
          const key = `${make}|||${model}`
          if (!camerasSeen.has(key)) {
            camerasSeen.set(key, { make, model, displayName: `${make} ${model}` })
          }
        }
      }
      manifest.cameras = Array.from(camerasSeen.values())

      const lensesSeen = new Map<string, LensInfo>()
      for (const photo of manifest.data) {
        const model = photo.exif?.LensModel
        if (model) {
          const make = photo.exif?.LensMake
          const key = `${make || ''}|||${model}`
          if (!lensesSeen.has(key)) {
            lensesSeen.set(key, { make: make || undefined, model, displayName: make ? `${make} ${model}` : model })
          }
        }
      }
      manifest.lenses = Array.from(lensesSeen.values())

      await saveManifest(manifest)
    }

    return Response.json({
      dryRun,
      totalBlobsScanned: allBlobs.length,
      originalPhotosFound: originalBlobs.length,
      alreadyInManifest: existingIds.size - recovered.length,
      recovered: recovered.length,
      errors,
      recoveredPhotos: recovered.map((p: PhotoManifestItem) => ({ id: p.id, pathname: p.s3Key, url: p.originalUrl })),
    })
  } catch (error) {
    console.error('Recovery error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Recovery failed' }, { status: 500 })
  }
}
