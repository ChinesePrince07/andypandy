import type { NextRequest } from 'next/server'

import { getManifestSafe } from '~/lib/manifest'
import { serveSPAWithMeta } from '~/lib/ssr-meta'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ lensName: string }> }) {
  const { lensName } = await params
  const decodedLens = decodeURIComponent(lensName)
  const manifest = await getManifestSafe()
  const count = manifest.data.filter((p) => {
    if (!p.exif?.LensModel) return false
    const lensMake = p.exif.LensMake?.trim()
    const lensModel = p.exif.LensModel.trim()
    return (lensMake ? `${lensMake} ${lensModel}` : lensModel) === decodedLens
  }).length

  return serveSPAWithMeta(request, {
    title: decodedLens,
    description: `${count} photo${count !== 1 ? 's' : ''} shot with ${decodedLens}`,
    ogImagePath: `/api/og/lens/${encodeURIComponent(lensName)}`,
  })
}
