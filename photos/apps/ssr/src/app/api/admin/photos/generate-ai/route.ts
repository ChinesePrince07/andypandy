import type { NextRequest } from 'next/server'

import { generatePhotoAI, reverseGeocode } from '~/lib/ai'
import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { ids, overwrite = false } = await req.json()

    const manifest = await getManifest()

    // If specific IDs provided, use those; otherwise process all photos
    const targetPhotos =
      ids && Array.isArray(ids) && ids.length > 0 ? manifest.data.filter((p) => ids.includes(p.id)) : manifest.data

    let updated = 0
    let failed = 0
    let skipped = 0

    for (const photo of targetPhotos) {
      // Skip if already has AI-generated content and not overwriting
      if (!overwrite && photo.title && photo.tags && photo.tags.length > 0) {
        skipped++
        continue
      }

      try {
        // Download thumbnail and convert to base64
        const thumbRes = await fetch(photo.thumbnailUrl)
        if (!thumbRes.ok) {
          failed++
          continue
        }
        const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer())
        const base64 = thumbBuffer.toString('base64')

        const aiResult = await generatePhotoAI(base64)
        if (!aiResult) {
          failed++
          continue
        }

        // Reverse-geocode from photo location
        let cityTag: string | null = null
        if (photo.location?.latitude && photo.location?.longitude) {
          const geo = await reverseGeocode(photo.location.latitude, photo.location.longitude)
          cityTag = geo.city
          // Fill in missing location details
          if (!photo.location.locationName && geo.locationName) {
            photo.location.locationName = geo.locationName
            photo.location.city = geo.city || undefined
            photo.location.country = geo.country || undefined
          }
        }

        // Apply AI results — only fill in missing fields unless overwrite is true
        if (overwrite || !photo.title || photo.title === photo.id) {
          photo.title = aiResult.title
        }
        if (overwrite || !photo.tags || photo.tags.length === 0) {
          let tags = aiResult.tags
          if (cityTag && !tags.includes(cityTag)) {
            tags = [cityTag, ...tags]
          }
          photo.tags = tags
        } else if (cityTag && !photo.tags.includes(cityTag)) {
          // Even if keeping existing tags, prepend city if missing
          photo.tags = [cityTag, ...photo.tags]
        }

        updated++
      } catch {
        failed++
      }
    }

    await saveManifest(manifest)

    return Response.json({ updated, failed, skipped, total: targetPhotos.length })
  } catch (error) {
    console.error('Bulk AI generation error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'AI generation failed' }, { status: 500 })
  }
}
