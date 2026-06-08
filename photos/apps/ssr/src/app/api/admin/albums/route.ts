import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const manifest = await getManifest()
  return Response.json(manifest.albums || [])
}

export async function POST(req: NextRequest) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { name, description, photoIds, coverPhotoId } = await req.json()
  if (!name || typeof name !== 'string') {
    return Response.json({ error: 'Album name is required' }, { status: 400 })
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const album = {
    id,
    name: name.trim(),
    description: (description || '').trim(),
    photoIds: Array.isArray(photoIds) ? photoIds : [],
    coverPhotoId: coverPhotoId || null,
    createdAt: new Date().toISOString(),
  }

  const manifest = await getManifest()
  if (!manifest.albums) manifest.albums = []
  manifest.albums.push(album)
  await saveManifest(manifest)

  return Response.json(album, { status: 201 })
}
