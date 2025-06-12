import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

interface PhotoData {
  id: string
  title: string
  description: string
  dateTaken: string
  views: number
  tags: string[]
  originalUrl: string
  thumbnailUrl: string
  blurhash: string
  width: number
  height: number
  aspectRatio: number
  s3Key: string
  lastModified: string
  size: number
  exif?: any
  isLivePhoto: boolean
}

interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  author: {
    name: string
    url: string
    avatar?: string
  }
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function createFeedSitemapPlugin(siteConfig: SiteConfig): Plugin {
  return {
    name: 'feed-sitemap-generator',
    apply: 'build',
    generateBundle() {
      try {
        // Read photos manifest
        const manifestPath = resolve(
          __dirname,
          '../../packages/data/src/photos-manifest.json',
        )
        const photosData: PhotoData[] = JSON.parse(
          readFileSync(manifestPath, 'utf-8'),
        )

        // Sort photos by date taken (newest first)
        const sortedPhotos = photosData.sort(
          (a, b) =>
            new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
        )

        // Generate RSS feed
        const rssXml = generateRSSFeed(sortedPhotos, siteConfig)

        // Generate sitemap
        const sitemapXml = generateSitemap(sortedPhotos, siteConfig)

        // Emit RSS feed
        this.emitFile({
          type: 'asset',
          fileName: 'feed.xml',
          source: rssXml,
        })

        // Emit sitemap
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: sitemapXml,
        })

        console.info(`Generated RSS feed with ${sortedPhotos.length} photos`)
        console.info(`Generated sitemap with ${sortedPhotos.length + 1} URLs`)
      } catch (error) {
        console.error('Error generating RSS feed and sitemap:', error)
      }
    },
  }
}

function generateRSSFeed(photos: PhotoData[], config: SiteConfig): string {
  const now = new Date().toUTCString()
  const latestPhoto = photos[0]
  const lastBuildDate = latestPhoto
    ? new Date(latestPhoto.dateTaken).toUTCString()
    : now

  // Take latest 20 photos for RSS feed
  const recentPhotos = photos.slice(0, 20)

  const rssItems = recentPhotos
    .map((photo) => {
      const photoUrl = `${config.url}/${photo.id}`
      const pubDate = new Date(photo.dateTaken).toUTCString()
      const tags = photo.tags.join(', ')

      let description = photo.description || photo.title
      if (tags) {
        description += ` | Tags: ${tags}`
      }

      return `    <item>
      <title><![CDATA[${escapeXml(photo.title)}]]></title>
      <link>${photoUrl}</link>
      <guid isPermaLink="true">${photoUrl}</guid>
      <description><![CDATA[${escapeXml(description)}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${photo.tags.map((tag) => `<category><![CDATA[${escapeXml(tag)}]]></category>`).join('\n      ')}
      <enclosure url="${photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : config.url + photo.thumbnailUrl}" type="image/webp" length="${photo.size}" />
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${escapeXml(config.title)}]]></title>
    <link>${config.url}</link>
    <description><![CDATA[${escapeXml(config.description)}]]></description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${config.url}/feed.xml" rel="self" type="application/rss+xml" />
    <managingEditor>${config.author.name}</managingEditor>
    <webMaster>${config.author.name}</webMaster>
    <generator>Vite RSS Generator</generator>
    <image>
      <url>${config.author.avatar || `${config.url}/favicon.ico`}</url>
      <title><![CDATA[${escapeXml(config.title)}]]></title>
      <link>${config.url}</link>
    </image>
${rssItems}
  </channel>
</rss>`
}

function generateSitemap(photos: PhotoData[], config: SiteConfig): string {
  const now = new Date().toISOString()

  // Main page
  const mainPageXml = `  <url>
    <loc>${config.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`

  // Photo pages
  const photoUrls = photos
    .map((photo) => {
      const lastmod = new Date(
        photo.lastModified || photo.dateTaken,
      ).toISOString()
      return `  <url>
    <loc>${config.url}/${photo.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mainPageXml}
${photoUrls}
</urlset>`
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
