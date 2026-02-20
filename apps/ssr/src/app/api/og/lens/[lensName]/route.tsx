import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

import { getManifest } from '~/lib/blob'
import { getOGImageLayout } from '~/lib/og-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ lensName: string }> }) {
  const { lensName } = await params
  const decodedLens = decodeURIComponent(lensName)
  const manifest = await getManifest()
  const photos = manifest.data.filter((p) => {
    if (!p.exif?.LensModel) return false
    const lensMake = p.exif.LensMake?.trim()
    const lensModel = p.exif.LensModel.trim()
    return (lensMake ? `${lensMake} ${lensModel}` : lensModel) === decodedLens
  })

  const layout = getOGImageLayout(decodedLens, `${photos.length} photo${photos.length !== 1 ? 's' : ''}`, photos)
  return new ImageResponse(layout.element, layout.options)
}
