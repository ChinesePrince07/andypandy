import type { NextRequest } from 'next/server'

import { rgbaToThumbHash } from 'thumbhash'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest, uploadToBlob } from '~/lib/blob'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

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

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    // Image processing with Sharp
    const sharp = (await import('sharp')).default
    const image = sharp(buffer)
    const metadata = await image.metadata()
    const { width, height, format } = metadata

    // Generate thumbnail (max 1600px wide, WebP)
    const thumbnailBuffer = await image
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    // Generate thumbhash
    const { data, info } = await sharp(buffer)
      .resize({ width: 100, height: 100, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const thumbHashArray = rgbaToThumbHash(info.width, info.height, data)
    const thumbHashBase64 = Buffer.from(thumbHashArray).toString('base64')

    // Extract EXIF data
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
      // Use exifr.gps() for proper decimal degree conversion
      const gps = await exifr.gps(buffer)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        gpsDecimal = { latitude: gps.latitude, longitude: gps.longitude }
      }
    } catch {
      // EXIF parsing can fail for some images, continue without it
    }

    // Build PickedExif — store GPS as decimal numbers, not raw EXIF arrays
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
          ImageWidth: exifData.ImageWidth || width || undefined,
          ImageHeight: exifData.ImageHeight || height || undefined,
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

    // Extract date taken
    let dateTaken: string | null = null
    if (exifData?.DateTimeOriginal) {
      dateTaken =
        exifData.DateTimeOriginal instanceof Date
          ? exifData.DateTimeOriginal.toISOString()
          : String(exifData.DateTimeOriginal)
    } else if (exifData?.CreateDate) {
      dateTaken = exifData.CreateDate instanceof Date ? exifData.CreateDate.toISOString() : String(exifData.CreateDate)
    }

    // Extract GPS location as decimal degrees
    let gpsData: LocationInfo | null = null
    if (gpsDecimal) {
      gpsData = {
        latitude: gpsDecimal.latitude,
        longitude: gpsDecimal.longitude,
      }
    }

    // Upload original to Vercel Blob
    const ext = format || 'jpg'
    const originalUrl = await uploadToBlob(`photos/original/${id}.${ext}`, buffer, file.type || 'image/jpeg')

    // Upload thumbnail to Vercel Blob
    const thumbnailUrl = await uploadToBlob(`photos/thumb/${id}.webp`, thumbnailBuffer, 'image/webp')

    // Build photo manifest item
    const photoItem: PhotoManifestItem = {
      id,
      title: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      dateTaken: dateTaken || new Date().toISOString(),
      tags: [],
      originalUrl,
      thumbnailUrl,
      ogImageUrl: null,
      thumbHash: thumbHashBase64,
      width: width || 0,
      height: height || 0,
      aspectRatio: width && height ? width / height : 1,
      s3Key: `photos/original/${id}.${ext}`,
      format: format || 'unknown',
      size: buffer.length,
      lastModified: new Date().toISOString(),
      exif: pickedExif,
      toneAnalysis: null,
      location: gpsData,
      isHDR: false,
    }

    // Update manifest
    const manifest = await getManifest()
    manifest.data.unshift(photoItem)
    manifest.cameras = rebuildCameras(manifest.data)
    manifest.lenses = rebuildLenses(manifest.data)
    await saveManifest(manifest)

    return Response.json(photoItem)
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}
