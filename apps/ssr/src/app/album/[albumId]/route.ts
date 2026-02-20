import type { NextRequest } from 'next/server'

import { getManifest } from '~/lib/blob'
import { serveSPAWithMeta } from '~/lib/ssr-meta'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params
  const manifest = await getManifest()
  const album = (manifest.albums || []).find((a) => a.id === albumId)

  if (!album) {
    return serveSPAWithMeta(request, {
      title: 'Album not found',
      description: '',
      ogImagePath: `/api/og/album/${albumId}`,
    })
  }

  return serveSPAWithMeta(request, {
    title: album.name,
    description: album.description || `${album.photoIds.length} photos`,
    ogImagePath: `/api/og/album/${albumId}`,
  })
}
