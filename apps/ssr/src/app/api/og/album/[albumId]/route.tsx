import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { getManifest } from '~/lib/blob'
import { getOGImageLayout } from '~/lib/og-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  const manifest = await getManifest()
  const album = (manifest.albums || []).find((a) => a.id === albumId)

  if (!album) {
    return new Response('Album not found', { status: 404 })
  }

  const idSet = new Set(album.photoIds)
  const photos = manifest.data.filter((p) => idSet.has(p.id))

  const layout = getOGImageLayout(
    album.name,
    `${photos.length} photo${photos.length !== 1 ? 's' : ''}`,
    photos,
  )

  return new ImageResponse(layout.element, layout.options)
}
