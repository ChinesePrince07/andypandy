import type { NextRequest } from 'next/server'

import { rgbaToThumbHash } from 'thumbhash'

import type { CameraInfo, LensInfo, LocationInfo, PickedExif, PhotoManifestItem } from '@afilmory/typing'

import { generatePhotoAI, reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { deleteFromBlob, getManifest, listAllBlobs, saveManifest, uploadToBlob } from '~/lib/blob'

export const maxDuration = 300
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
    const body = await req.json()

    // Recovery mode: scan blob storage for orphaned photos
    if (body.action === 'recover') {
      return handleRecover(body)
    }

    // Cleanup mode: delete orphaned blobs not referenced by any manifest entry
    if (body.action === 'cleanup') {
      return handleCleanup(body)
    }

    // Fix thumbHash encoding: convert any base64 thumbHashes to hex
    if (body.action === 'fix-thumbhash') {
      return handleFixThumbHash()
    }

    const { blobUrl, filename, tags: userTags, title: userTitle } = body
    if (!blobUrl || !filename) {
      return Response.json({ error: 'Missing blobUrl or filename' }, { status: 400 })
    }

    // Download the uploaded blob
    const blobRes = await fetch(blobUrl)
    if (!blobRes.ok) {
      return Response.json({ error: 'Failed to download uploaded file' }, { status: 500 })
    }
    const buffer = Buffer.from(await blobRes.arrayBuffer())
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    // Image processing with Sharp (with orientation fix)
    const sharp = (await import('sharp')).default
    const image = sharp(buffer).rotate()
    const metadata = await image.metadata()
    const { format } = metadata

    // Compute orientation-aware full-resolution dimensions
    let fullWidth = metadata.width || 0
    let fullHeight = metadata.height || 0
    const orientation = metadata.orientation
    if (orientation && orientation >= 5 && orientation <= 8) {
      ;[fullWidth, fullHeight] = [fullHeight, fullWidth]
    }

    // Generate thumbnail (max 1600px wide, WebP)
    const { data: thumbnailBuffer } = await image
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })

    // Generate thumbhash
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: 100, height: 100, fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const thumbHashArray = rgbaToThumbHash(info.width, info.height, data)
    // Encode as hex string to match frontend's decompressUint8Array expectation
    const thumbHashHex = Array.from(thumbHashArray)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

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
      const gps = await exifr.gps(buffer)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        gpsDecimal = { latitude: gps.latitude, longitude: gps.longitude }
      }
    } catch {
      // EXIF parsing can fail for some images, continue without it
    }

    // Build PickedExif
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

    // Extract GPS location and reverse-geocode
    let gpsData: LocationInfo | null = null
    let cityTag: string | null = null
    if (gpsDecimal) {
      const geo = await reverseGeocode(gpsDecimal.latitude, gpsDecimal.longitude)
      cityTag = geo.city
      gpsData = {
        latitude: gpsDecimal.latitude,
        longitude: gpsDecimal.longitude,
        country: geo.country || undefined,
        city: geo.city || undefined,
        locationName: geo.locationName || undefined,
      }
    }

    // Upload thumbnail to Vercel Blob (original is already uploaded via client)
    const thumbnailUrl = await uploadToBlob(`photos/thumb/${id}.webp`, thumbnailBuffer, 'image/webp')

    // Generate AI title and tags (non-blocking — falls back gracefully)
    const aiResult = await generatePhotoAI(thumbnailBuffer.toString('base64'))

    // Use user-provided values with AI fallback
    const finalTitle = userTitle?.trim() || aiResult?.title || filename.replace(/\.[^.]+$/, '')
    let finalTags =
      userTags && userTags.length > 0
        ? userTags.map((t: string) => t.trim().toLowerCase()).filter(Boolean)
        : aiResult?.tags || []

    // Prepend city as first tag if available
    if (cityTag && !finalTags.includes(cityTag)) {
      finalTags = [cityTag, ...finalTags]
    }

    // Build photo manifest item
    const ext = format || 'jpg'
    const photoItem: PhotoManifestItem = {
      id,
      title: finalTitle,
      description: '',
      dateTaken: dateTaken || new Date().toISOString(),
      tags: finalTags,
      originalUrl: blobUrl,
      thumbnailUrl,
      ogImageUrl: null,
      thumbHash: thumbHashHex,
      width: fullWidth,
      height: fullHeight,
      aspectRatio: fullWidth && fullHeight ? fullWidth / fullHeight : 1,
      s3Key: `photos/original/${id}.${ext}`,
      format: format || 'unknown',
      size: buffer.length,
      lastModified: new Date().toISOString(),
      exif: pickedExif,
      toneAnalysis: null,
      location: gpsData,
      isHDR: false,
    }

    // Update manifest with retry to handle concurrent writes
    for (let attempt = 0; attempt < 5; attempt++) {
      const manifest = await getManifest()
      // Skip if already added (dedup)
      if (manifest.data.some((p) => p.id === photoItem.id)) break
      manifest.data.push(photoItem)
      manifest.data.sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())
      manifest.cameras = rebuildCameras(manifest.data)
      manifest.lenses = rebuildLenses(manifest.data)
      await saveManifest(manifest)

      // Brief delay to allow Vercel Blob propagation before verification
      await new Promise((r) => setTimeout(r, 500))

      // Verify the write succeeded by re-reading
      const verification = await getManifest()
      if (verification.data.some((p) => p.id === photoItem.id)) break
      // If not found, another concurrent write overwrote us — retry with backoff
      const backoff = 1000 * (attempt + 1)
      console.warn(`Manifest write lost for ${photoItem.id}, retrying in ${backoff}ms (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, backoff))
    }

    return Response.json(photoItem)
  } catch (error) {
    console.error('Process error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Processing failed' }, { status: 500 })
  }
}

async function handleRecover(body: any) {
  try {
    const dryRun = body.dryRun !== false

    const manifest = await getManifest()
    const existingIds = new Set(manifest.data.map((p: PhotoManifestItem) => p.id))

    const allBlobs = await listAllBlobs()

    const imageExtensions = new Set([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'tiff',
      'tif',
      'heic',
      'heif',
      'avif',
      'bmp',
      'svg',
    ])
    const originalBlobs = allBlobs.filter((b: any) => {
      if (b.pathname.startsWith('photos/thumb/')) return false
      if (b.pathname === 'manifest.json') return false
      // Check content type if available, otherwise check file extension
      if (b.contentType?.startsWith('image/')) return true
      const ext = b.pathname.split('.').pop()?.toLowerCase() || ''
      return imageExtensions.has(ext)
    })

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

        const thumbData = await sharp(buffer)
          .rotate()
          .resize({ width: 100, height: 100, fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const thumbHashArray = rgbaToThumbHash(thumbData.info.width, thumbData.info.height, thumbData.data)
        const thumbHashHex = Array.from(thumbHashArray)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')

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
      // Re-read manifest fresh to avoid overwriting concurrent changes
      const freshManifest = await getManifest()
      const freshIds = new Set(freshManifest.data.map((p) => p.id))
      const newPhotos = recovered.filter((p) => !freshIds.has(p.id))
      freshManifest.data.push(...newPhotos)
      freshManifest.data.sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())
      freshManifest.cameras = rebuildCameras(freshManifest.data)
      freshManifest.lenses = rebuildLenses(freshManifest.data)

      console.log(`[RECOVER] Saving manifest with ${freshManifest.data.length} photos (${newPhotos.length} new)`)
      await saveManifest(freshManifest)

      // Verify
      await new Promise((r) => setTimeout(r, 1000))
      const verification = await getManifest()
      console.log(`[RECOVER] Verification: manifest has ${verification.data.length} photos`)
      if (verification.data.length < freshManifest.data.length) {
        console.error(
          `[RECOVER] Manifest verification failed! Expected ${freshManifest.data.length}, got ${verification.data.length}`,
        )
        // Retry once
        await saveManifest(freshManifest)
        await new Promise((r) => setTimeout(r, 1000))
        const retry = await getManifest()
        console.log(`[RECOVER] Retry verification: manifest has ${retry.data.length} photos`)
      }
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

async function handleCleanup(body: any) {
  try {
    const dryRun = body.dryRun !== false

    const manifest = await getManifest()
    const allBlobs = await listAllBlobs()

    // Build a set of all URLs referenced by the manifest
    const referencedUrls = new Set<string>()
    for (const photo of manifest.data) {
      if (photo.originalUrl) referencedUrls.add(photo.originalUrl)
      if (photo.thumbnailUrl) referencedUrls.add(photo.thumbnailUrl)
      if (photo.ogImageUrl) referencedUrls.add(photo.ogImageUrl)
    }

    // Find orphaned blobs (not referenced by manifest, not the manifest itself)
    const orphaned = allBlobs.filter((b) => {
      if (b.pathname === 'manifest.json') return false
      return !referencedUrls.has(b.url)
    })

    const deleted: string[] = []
    const errors: string[] = []

    if (!dryRun) {
      for (const blob of orphaned) {
        try {
          await deleteFromBlob(blob.url)
          deleted.push(blob.pathname)
        } catch (e) {
          errors.push(`Failed to delete ${blob.pathname}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    return Response.json({
      dryRun,
      totalBlobs: allBlobs.length,
      referencedBlobs: referencedUrls.size,
      orphanedBlobs: orphaned.length,
      deleted: deleted.length,
      errors,
      orphanedList: orphaned.map((b) => ({ pathname: b.pathname, url: b.url, size: b.size })),
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Cleanup failed' }, { status: 500 })
  }
}

async function handleFixThumbHash() {
  try {
    const manifest = await getManifest()
    let fixed = 0

    for (const photo of manifest.data) {
      if (!photo.thumbHash || typeof photo.thumbHash !== 'string') continue
      // Check if it looks like base64 (contains +, /, or = which are not hex chars)
      if (/[+/=A-Z]/.test(photo.thumbHash)) {
        try {
          const raw = Buffer.from(photo.thumbHash, 'base64')
          photo.thumbHash = Array.from(raw)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
          fixed++
        } catch {
          // Not valid base64, skip
        }
      }
    }

    if (fixed > 0) {
      const savedUrl = await saveManifest(manifest)
      // Verify by reading back
      await new Promise((r) => setTimeout(r, 1000))
      const verification = await getManifest()
      const stillBad = verification.data.filter((p) => p.thumbHash && /[+/=A-Z]/.test(p.thumbHash)).length
      return Response.json({
        fixed,
        total: manifest.data.length,
        savedUrl,
        verified: stillBad === 0,
        stillBadCount: stillBad,
      })
    }

    return Response.json({ fixed: 0, total: manifest.data.length })
  } catch (error) {
    console.error('Fix thumbhash error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Fix failed' }, { status: 500 })
  }
}
