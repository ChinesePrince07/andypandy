import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/manifest'
import { getOGImageLayout } from '~/lib/og-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ make: string; model: string }> }) {
  const { make, model } = await params
  const displayName = `${decodeURIComponent(make)} ${decodeURIComponent(model)}`
  const manifest = await getManifestSafe()
  const photos = manifest.data.filter((p) => {
    if (!p.exif?.Make || !p.exif?.Model) return false
    return `${p.exif.Make.trim()} ${p.exif.Model.trim()}` === displayName
  })

  const layout = getOGImageLayout(
    `Shot on ${displayName}`,
    `${photos.length} photo${photos.length !== 1 ? 's' : ''}`,
    photos,
  )
  return new ImageResponse(layout.element, layout.options)
}
