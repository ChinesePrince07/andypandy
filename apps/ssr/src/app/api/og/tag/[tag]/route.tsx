import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/blob'
import { getOGImageLayout } from '~/lib/og-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)
  const manifest = await getManifestSafe()
  const photos = manifest.data.filter((p) => p.tags.includes(decodedTag))

  const layout = getOGImageLayout(`#${decodedTag}`, `${photos.length} photo${photos.length !== 1 ? 's' : ''}`, photos)
  return new ImageResponse(layout.element, layout.options)
}
