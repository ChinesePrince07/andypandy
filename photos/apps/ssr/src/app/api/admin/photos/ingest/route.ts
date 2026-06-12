import type { NextRequest } from 'next/server'

import { rgbaToThumbHash } from 'thumbhash'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

import { reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'
import { uploadToR2 } from '~/lib/r2'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Ingest an ALREADY-uploaded original (hosted in R2 by the andypandy.org admin /
// iOS app) into the gallery manifest: generate a thumbnail, extract EXIF, and
// append/update the entry. Unlike /photos/process this keeps the caller's s3Key
// and derives a stable id from it, so the entry lines up with the rest of the
// R2-keyed tooling (sort, EXIF reconcile, delete). Body: { url, s3Key }.
export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  let body: { url?: string; s3Key?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = body.url
  const s3Key = body.s3Key
  if (!url || !s3Key) {
    return Response.json({ error: 'Missing url or s3Key' }, { status: 400 })
  }

  const id = idFromKey(s3Key)
  const ext = (s3Key.split('.').pop() || 'jpg').toLowerCase()

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return Response.json({ error: `Failed to download original: ${res.status}` }, { status: 502 })
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

    // Thumbnail (max 1600px wide, WebP) → R2
    const { data: thumbnailBuffer } = await image
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
    const thumbnailUrl = await uploadToR2(`photos/thumb/${id}.webp`, thumbnailBuffer, 'image/webp')

    // ThumbHash
    const { data: thumbRaw, info } = await sharp(buffer)
      .rotate()
      .resize({ width: 100, height: 100, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const thumbHashArray = rgbaToThumbHash(info.width, info.height, thumbRaw)
    const thumbHashHex = Array.from(thumbHashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // EXIF
    const exifr = (await import('exifr')).default
    let exifData: Record<string, any> | null = null
    let gpsDecimal: { latitude: number; longitude: number } | null = null
    try {
      exifData = await exifr.parse(buffer, {
        pick: [
          'Make', 'Model', 'LensModel', 'LensMake', 'FocalLength', 'FocalLengthIn35mmFormat',
          'FNumber', 'ISO', 'ExposureTime', 'ExposureCompensation', 'WhiteBalance',
          'DateTimeOriginal', 'CreateDate', 'Flash', 'MeteringMode', 'ColorSpace',
          'ImageWidth', 'ImageHeight', 'Orientation',
        ],
      })
      const gps = await exifr.gps(buffer)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        gpsDecimal = { latitude: gps.latitude, longitude: gps.longitude }
      }
    } catch {
      // EXIF parsing can fail; continue without it
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
      dateTaken = exifData.CreateDate instanceof Date ? exifData.CreateDate.toISOString() : String(exifData.CreateDate)
    }

    let location: LocationInfo | null = null
    let cityTag: string | null = null
    if (gpsDecimal) {
      const geo = await reverseGeocode(gpsDecimal.latitude, gpsDecimal.longitude)
      cityTag = geo.city
      location = {
        latitude: gpsDecimal.latitude,
        longitude: gpsDecimal.longitude,
        country: geo.country || undefined,
        city: geo.city || undefined,
        locationName: geo.locationName || undefined,
      }
    }

    const title = s3Key.split('/').pop()?.replace(/\.\w+$/, '') || id

    const photoItem: PhotoManifestItem = {
      id,
      title,
      description: '',
      dateTaken: dateTaken || new Date().toISOString(),
      tags: cityTag ? [cityTag] : [],
      originalUrl: url,
      thumbnailUrl,
      ogImageUrl: null,
      thumbHash: thumbHashHex,
      width: fullWidth,
      height: fullHeight,
      aspectRatio: fullWidth && fullHeight ? fullWidth / fullHeight : 1,
      s3Key,
      format: metadata.format || ext,
      size: buffer.length,
      lastModified: new Date().toISOString(),
      exif: pickedExif,
      toneAnalysis: null,
      location,
      isHDR: false,
    }

    // Replace any existing entry with this id; otherwise append. Re-sort by date.
    const manifest = await getManifest()
    const existingIndex = manifest.data.findIndex((p) => p.id === id)
    if (existingIndex >= 0) {
      manifest.data[existingIndex] = photoItem
    } else {
      manifest.data.push(photoItem)
    }
    manifest.data.sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())
    manifest.cameras = rebuildCameras(manifest.data)
    manifest.lenses = rebuildLenses(manifest.data)
    await saveManifest(manifest)

    return Response.json(photoItem)
  } catch (error) {
    console.error('Ingest error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Ingest failed' }, { status: 500 })
  }
}

function idFromKey(key: string): string {
  const base = key.split('/').pop() || key
  return base.replace(/\.[^.]+$/, '')
}

function rebuildCameras(photos: PhotoManifestItem[]): CameraInfo[] {
  const seen = new Map<string, CameraInfo>()
  for (const photo of photos) {
    const make = photo.exif?.Make
    const model = photo.exif?.Model
    if (make && model) {
      const key = `${make}|||${model}`
      if (!seen.has(key)) seen.set(key, { make, model, displayName: `${make} ${model}` })
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
      if (!seen.has(key)) seen.set(key, { make: make || undefined, model, displayName: make ? `${make} ${model}` : model })
    }
  }
  return Array.from(seen.values())
}
