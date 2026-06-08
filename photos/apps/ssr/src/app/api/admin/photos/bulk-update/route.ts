import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { ids, updates } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Missing or empty ids array' }, { status: 400 })
    }

    const manifest = await getManifest()
    const idSet = new Set(ids as string[])
    let updated = 0

    for (const photo of manifest.data) {
      if (!idSet.has(photo.id)) continue

      // Add tags (merge, no duplicates)
      if (Array.isArray(updates?.addTags)) {
        const existing = new Set(photo.tags || [])
        for (const tag of updates.addTags) {
          if (typeof tag === 'string' && tag.trim()) {
            existing.add(tag.trim())
          }
        }
        photo.tags = Array.from(existing)
      }

      // Remove tags
      if (Array.isArray(updates?.removeTags)) {
        const toRemove = new Set(updates.removeTags)
        photo.tags = (photo.tags || []).filter((t) => !toRemove.has(t))
      }

      // Update title (applies same title to all selected)
      if (typeof updates?.title === 'string') {
        photo.title = updates.title
      }

      // Update description
      if (typeof updates?.description === 'string') {
        photo.description = updates.description
      }

      updated++
    }

    await saveManifest(manifest)

    return Response.json({ updated })
  } catch (error) {
    console.error('Bulk update error:', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Bulk update failed' }, { status: 500 })
  }
}
