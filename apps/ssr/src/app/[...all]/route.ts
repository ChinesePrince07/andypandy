import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import { verifyAdmin } from '~/lib/admin-auth'
import { getManifest } from '~/lib/blob'
import { injectAdminButton, injectConfigToDocument, injectManifestToDocument } from '~/lib/injectable'

export const dynamic = 'force-dynamic'

const renderIndex = async () => {
  const indexHtml = await import('../../index.html').then((m) => m.default)
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

const handler = async (req: NextRequest) => {
  if (process.env.NODE_ENV === 'development') {
    return import('./dev').then((m) => m.handler(req))
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 404 })
  }

  const acceptsHtml = req.headers.get('accept')?.includes('text/html')
  if (!acceptsHtml) {
    return new Response(null, { status: 404 })
  }

  return renderIndex()
}

export const GET = handler
export const HEAD = handler
export const OPTIONS = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
