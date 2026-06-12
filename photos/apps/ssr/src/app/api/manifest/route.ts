import { getManifestSafe } from '~/lib/manifest'

// Public projection of the manifest so other services (e.g. the andypandy.org
// admin API that powers the iOS app) can render the exact same gallery the site
// shows, and sort by capture date. The full manifest is already injected into
// the public homepage HTML, so exposing this subset adds no new surface.
export const dynamic = 'force-dynamic'

export async function GET() {
  const manifest = await getManifestSafe()
  const photos = manifest.data.map((p) => ({
    id: p.id,
    s3Key: p.s3Key,
    title: p.title ?? '',
    originalUrl: p.originalUrl,
    thumbnailUrl: p.thumbnailUrl || p.originalUrl,
    dateTaken: p.dateTaken ?? null,
    lastModified: p.lastModified ?? p.dateTaken ?? null,
    size: p.size ?? 0,
    width: p.width ?? 0,
    height: p.height ?? 0,
    aspectRatio: p.aspectRatio ?? (p.width && p.height ? p.width / p.height : 1),
  }))

  return Response.json(
    { photos },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } },
  )
}
