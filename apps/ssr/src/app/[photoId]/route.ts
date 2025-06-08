import { DOMParser } from 'linkedom'
import type { HTMLDocument } from 'linkedom/types/html/document'
import type { NextRequest } from 'next/server'

import { photoLoader } from '../../../../web/src/data/photos'
import type { PhotoManifest } from '../../../../web/src/types/photo'
import { getIndexHtml } from '../../constants'

export const runtime = 'edge'
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) => {
  const { photoId } = await params

  const indexHtml = await getIndexHtml()
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')

  // Remove all twitter meta tags and open graph meta tags
  document.head.childNodes.forEach((node) => {
    if (node.nodeName === 'META') {
      const $meta = node as HTMLMetaElement
      if ($meta.getAttribute('property')?.startsWith('twitter:')) {
        $meta.remove()
      }
      if ($meta.getAttribute('property')?.startsWith('og:')) {
        $meta.remove()
      }
    }
  })

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response('Photo not found', { status: 404 })
  }

  // Insert meta open graph tags and twitter meta tags
  createAndInsertOpenGraphMeta(document, photo)

  return new Response(document.documentElement.outerHTML, {
    headers: {
      'Content-Type': 'text/html',
      'X-SSR': '1',
    },
  })
}

const createAndInsertOpenGraphMeta = (
  document: HTMLDocument,
  photo: PhotoManifest,
) => {
  const og = {
    name: photo.id,
    description: photo.description,
    image: photo.originalUrl,
  }

  for (const [key, value] of Object.entries(og)) {
    const ogMeta = document.createElement('meta')
    ogMeta.setAttribute('property', `og:${key}`)
    ogMeta.setAttribute('content', value)
    const twitterMeta = document.createElement('meta')
    twitterMeta.setAttribute('name', `twitter:${key}`)
    twitterMeta.setAttribute('content', value)
    document.head.append(ogMeta as unknown as Node)
    document.head.append(twitterMeta as unknown as Node)
  }
  return document
}
