import siteConfig from '@config'
import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import { verifyAdmin } from '~/lib/admin-auth'
import { getManifest } from '~/lib/blob'
import { injectAdminButton, injectConfigToDocument, injectManifestToDocument } from '~/lib/injectable'

type HtmlElement = ReturnType<typeof DOMParser.prototype.parseFromString>
type OnlyHTMLDocument = HtmlElement extends infer T ? (T extends { [key: string]: any; head: any } ? T : never) : never

function getRealOrigin(request: NextRequest): string {
  const xForwardedHost = request.headers.get('x-forwarded-host')
  if (xForwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${xForwardedHost}`
  }
  return request.nextUrl.origin
}

function injectMetaTags(
  document: OnlyHTMLDocument,
  meta: { title: string; description: string; ogImage: string; url: string },
) {
  // Remove existing OG and Twitter meta tags
  const toRemove: Node[] = []
  document.head.childNodes.forEach((node) => {
    if (node.nodeName === 'META') {
      const $meta = node as HTMLMetaElement
      if ($meta.getAttribute('name')?.startsWith('twitter:')) toRemove.push(node)
      if ($meta.getAttribute('property')?.startsWith('og:')) toRemove.push(node)
    }
  })
  toRemove.forEach((node) => node.parentNode?.removeChild(node))

  document.head.title = meta.title

  const ogTags: Record<string, string> = {
    'og:type': 'website',
    'og:title': meta.title,
    'og:description': meta.description,
    'og:image': meta.ogImage,
    'og:url': meta.url,
  }
  for (const [property, content] of Object.entries(ogTags)) {
    const el = document.createElement('meta', {})
    el.setAttribute('property', property)
    el.setAttribute('content', content)
    document.head.append(el as unknown as Node)
  }

  const twitterTags: Record<string, string> = {
    'twitter:card': 'summary_large_image',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.ogImage,
  }
  for (const [name, content] of Object.entries(twitterTags)) {
    const el = document.createElement('meta', {})
    el.setAttribute('name', name)
    el.setAttribute('content', content)
    document.head.append(el as unknown as Node)
  }
}

export async function serveSPAWithMeta(
  request: NextRequest,
  meta: { title: string; description: string; ogImagePath: string },
) {
  const indexHtml = await import('../index.html').then((m) => m.default)
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')
  const realOrigin = getRealOrigin(request)

  injectMetaTags(document, {
    title: `${meta.title} | ${siteConfig.title}`,
    description: meta.description,
    ogImage: `${realOrigin}${meta.ogImagePath}`,
    url: `${realOrigin}${request.nextUrl.pathname}`,
  })

  injectConfigToDocument(document)
  const manifest = await getManifest()
  injectManifestToDocument(document, manifest)

  const isAdmin = await verifyAdmin()
  if (isAdmin) {
    injectAdminButton(document)
  }

  return new Response(document.documentElement.outerHTML, {
    headers: { 'Content-Type': 'text/html', 'X-SSR': '1' },
  })
}
