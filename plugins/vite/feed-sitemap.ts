import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

import type { SiteConfig } from '../../site.config'

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

      // Extract EXIF data for custom tags
      const exifTags = generateExifTags(photo.exif, photo)

      return `    <item>
      <title><![CDATA[${photo.title}]]></title>
      <link>${photoUrl}</link>
      <guid isPermaLink="true">${photoUrl}</guid>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${photo.tags.map((tag) => `<category><![CDATA[${tag}]]></category>`).join('\n      ')}
      <enclosure url="${photo.thumbnailUrl.startsWith('http') ? photo.thumbnailUrl : config.url + photo.thumbnailUrl}" type="image/webp" length="${photo.size}" />
${exifTags}
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:exif="https://exif.org/rss/1.0">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <link>${config.url}</link>
    <description><![CDATA[${config.description}]]></description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>60</ttl>
    <copyright>Copyright ${config.author.name}</copyright>
${
  config.feed?.folo?.challenge
    ? `
    <follow_challenge>
    <feedId>${config.feed?.folo?.challenge.feedId}</feedId>
    <userId>${config.feed?.folo?.challenge.userId}</userId>
</follow_challenge>
`
    : ''
}
    <atom:link href="${config.url}/feed.xml" rel="self" type="application/rss+xml" />
    <managingEditor>${config.author.name}</managingEditor>
    <webMaster>${config.author.name}</webMaster>
    <generator>Vite RSS Generator</generator>
    <image>
      <url>${config.author.avatar || `${config.url}/favicon.ico`}</url>
      <title><![CDATA[${config.title}]]></title>
      <link>${config.url}</link>
    </image>
${rssItems}
  </channel>
</rss>`
}

function generateExifTags(exif: any, photo: PhotoData): string {
  if (!exif || !exif.Photo) {
    return ''
  }

  const tags: string[] = []

  // Aperture (光圈)
  if (exif.Photo.FNumber) {
    tags.push(`      <exif:aperture>f/${exif.Photo.FNumber}</exif:aperture>`)
  }

  // Shutter Speed (快门)
  if (exif.Photo.ExposureTime) {
    const shutterSpeed =
      exif.Photo.ExposureTime >= 1
        ? `${exif.Photo.ExposureTime}s`
        : `1/${Math.round(1 / exif.Photo.ExposureTime)}s`
    tags.push(`      <exif:shutterSpeed>${shutterSpeed}</exif:shutterSpeed>`)
  }

  // ISO
  if (exif.Photo.ISOSpeedRatings) {
    tags.push(`      <exif:iso>${exif.Photo.ISOSpeedRatings}</exif:iso>`)
  }

  // Exposure Compensation (曝光补偿)
  if (exif.Photo.ExposureBiasValue !== undefined) {
    const ev = exif.Photo.ExposureBiasValue
    const evString = ev > 0 ? `+${ev}` : `${ev}`
    tags.push(
      `      <exif:exposureCompensation>${evString} EV</exif:exposureCompensation>`,
    )
  }

  // Image Dimensions (图片宽度, 高度)
  tags.push(
    `      <exif:imageWidth>${photo.width}</exif:imageWidth>`,
    `      <exif:imageHeight>${photo.height}</exif:imageHeight>`,
  )

  // Date Taken (拍摄时间)
  if (exif.Photo.DateTimeOriginal) {
    tags.push(
      `      <exif:dateTaken>${exif.Photo.DateTimeOriginal}</exif:dateTaken>`,
    )
  }

  // Camera Model (机型)
  if (exif.Image?.Make && exif.Image?.Model) {
    tags.push(
      `      <exif:camera><![CDATA[${exif.Image.Make} ${exif.Image.Model}]]></exif:camera>`,
    )
  }

  // Lens Model (镜头)
  if (exif.Photo.LensModel) {
    tags.push(
      `      <exif:lens><![CDATA[${exif.Photo.LensModel}]]></exif:lens>`,
    )
  }

  // Focal Length (焦段)
  if (exif.Photo.FocalLength) {
    tags.push(
      `      <exif:focalLength>${exif.Photo.FocalLength}mm</exif:focalLength>`,
    )
  }

  // Focal Length in 35mm equivalent (等效35mm焦距)
  if (exif.Photo.FocalLengthIn35mmFilm) {
    tags.push(
      `      <exif:focalLength35mm>${exif.Photo.FocalLengthIn35mmFilm}mm</exif:focalLength35mm>`,
    )
  }

  return tags.join('\n')
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
