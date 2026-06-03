import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { getManifest, saveManifest } from '~/lib/manifest'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params
  const manifest = await getManifest()
  const album = (manifest.albums || []).find((a) => a.id === id)
  if (!album) return Response.json({ error: 'Album not found' }, { status: 404 })

  return Response.json(album)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params
  const updates = await req.json()
  const manifest = await getManifest()
  if (!manifest.albums) manifest.albums = []

  const index = manifest.albums.findIndex((a) => a.id === id)
  if (index === -1) return Response.json({ error: 'Album not found' }, { status: 404 })

  const album = manifest.albums[index]
  if (updates.name !== undefined) album.name = updates.name.trim()
  if (updates.description !== undefined) album.description = updates.description.trim()
  if (updates.coverPhotoId !== undefined) album.coverPhotoId = updates.coverPhotoId
  if (Array.isArray(updates.addPhotoIds)) {
    const existing = new Set(album.photoIds)
    updates.addPhotoIds.forEach((pid: string) => existing.add(pid))
    album.photoIds = Array.from(existing)
  }
  if (Array.isArray(updates.removePhotoIds)) {
    const toRemove = new Set(updates.removePhotoIds)
    album.photoIds = album.photoIds.filter((pid) => !toRemove.has(pid))
  }

  manifest.albums[index] = album
  await saveManifest(manifest)

  return Response.json(album)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const { id } = await params
  const manifest = await getManifest()
  if (!manifest.albums) manifest.albums = []

  const index = manifest.albums.findIndex((a) => a.id === id)
  if (index === -1) return Response.json({ error: 'Album not found' }, { status: 404 })

  manifest.albums.splice(index, 1)
  await saveManifest(manifest)

  return Response.json({ success: true })
}
