import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/manifest'
import { serveSPAWithMeta } from '~/lib/ssr-meta'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ make: string; model: string }> }) {
  const { make, model } = await params
  const displayName = `${decodeURIComponent(make)} ${decodeURIComponent(model)}`
  const manifest = await getManifestSafe()
  const count = manifest.data.filter((p) => {
    if (!p.exif?.Make || !p.exif?.Model) return false
    return `${p.exif.Make.trim()} ${p.exif.Model.trim()}` === displayName
  }).length

  return serveSPAWithMeta(request, {
    title: `Shot on ${displayName}`,
    description: `${count} photo${count !== 1 ? 's' : ''} shot on ${displayName}`,
    ogImagePath: `/api/og/camera/${encodeURIComponent(make)}/${encodeURIComponent(model)}`,
  })
}
