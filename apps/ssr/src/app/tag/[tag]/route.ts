import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/blob'
import { serveSPAWithMeta } from '~/lib/ssr-meta'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)
  const manifest = await getManifestSafe()
  const count = manifest.data.filter((p) => p.tags.includes(decodedTag)).length

  return serveSPAWithMeta(request, {
    title: `#${decodedTag}`,
    description: `${count} photo${count !== 1 ? 's' : ''} tagged "${decodedTag}"`,
    ogImagePath: `/api/og/tag/${encodeURIComponent(tag)}`,
  })
}
