import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import { verifyAdmin } from '~/lib/admin-auth'
import { getManifest } from '~/lib/blob'
import { injectAdminButton, injectConfigToDocument, injectManifestToDocument } from '~/lib/injectable'

export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest) => {
  if (process.env.NODE_ENV === 'development') {
    return import('./[...all]/dev').then((m) => m.handler(req))
  }
  const indexHtml = await import('../index.html').then((m) => m.default)
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')
  injectConfigToDocument(document)
  const manifest = await getManifest()
  injectManifestToDocument(document, manifest)
  const isAdmin = await verifyAdmin()
  if (isAdmin) {
    injectAdminButton(document)
  }
  return new Response(document.documentElement.outerHTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-SSR': '1',
    },
  })
}
