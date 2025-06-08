import { photoLoader } from '@photo-gallery/data'
import type { PhotoManifest } from '@photo-gallery/data/types'
import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import indexHtml from '../../index.html'

type HtmlElement = ReturnType<typeof DOMParser.prototype.parseFromString>
type OnlyHTMLDocument = HtmlElement extends infer T
  ? T extends { [key: string]: any; head: any }
    ? T
    : never
  : never
export const runtime = 'edge'
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) => {
  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  try {
    const document = new DOMParser().parseFromString(indexHtml, 'text/html')

    // Remove all twitter meta tags and open graph meta tags
    document.head.childNodes.forEach((node) => {
      if (node.nodeName === 'META') {
        const $meta = node as HTMLMetaElement
        if ($meta.getAttribute('name')?.startsWith('twitter:')) {
          $meta.remove()
        }
        if ($meta.getAttribute('property')?.startsWith('og:')) {
          $meta.remove()
        }
      }
    })
    // Insert meta open graph tags and twitter meta tags
    createAndInsertOpenGraphMeta(document, photo, request)

    return new Response(document.documentElement.outerHTML, {
      headers: {
        'Content-Type': 'text/html',
        'X-SSR': '1',
      },
    })
  } catch (error) {
    console.error('Error generating SSR page:', error)
    console.info('Falling back to static index.html')
    console.info(error.message)

    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

const createAndInsertOpenGraphMeta = (
  document: OnlyHTMLDocument,
  photo: PhotoManifest,
  request: NextRequest,
) => {
  // Open Graph meta tags
  const ogTags = {
    'og:type': 'website',
    'og:title': photo.id,
    'og:description': photo.description || '',
    'og:image': `${request.nextUrl.origin}/og/${photo.id}`,
    'og:url': `${request.nextUrl.origin}/${photo.id}`,
  }

  for (const [property, content] of Object.entries(ogTags)) {
    const ogMeta = document.createElement('meta', {})
    ogMeta.setAttribute('property', property)
    ogMeta.setAttribute('content', content)
    document.head.append(ogMeta as unknown as Node)
  }

  // Twitter Card meta tags
  const twitterTags = {
    'twitter:card': 'summary_large_image',
    'twitter:title': photo.id,
    'twitter:description': photo.description || '',
    'twitter:image': `${request.nextUrl.origin}/og/${photo.id}`,
  }

  for (const [name, content] of Object.entries(twitterTags)) {
    const twitterMeta = document.createElement('meta', {})
    twitterMeta.setAttribute('name', name)
    twitterMeta.setAttribute('content', content)
    document.head.append(twitterMeta as unknown as Node)
  }

  return document
}
