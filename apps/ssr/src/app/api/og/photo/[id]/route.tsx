import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/blob'
import { getOGImageLayout } from '~/lib/og-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const manifest = await getManifestSafe()
  const photo = manifest.data.find((p) => p.id === id)

  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  const subtitle = [
    photo.dateTaken ? new Date(photo.dateTaken).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
    photo.exif?.Make && photo.exif?.Model ? `${photo.exif.Make} ${photo.exif.Model}` : null,
  ].filter(Boolean).join(' \u00b7 ')

  const layout = getOGImageLayout(photo.title || 'Untitled', subtitle, [photo])
  return new ImageResponse(layout.element, layout.options)
}
