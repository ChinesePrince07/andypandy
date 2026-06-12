import { buildInstallPlist, getApp, slugify } from '@/lib/ios-apps'
import { r2AbsoluteUrl } from '@/lib/r2-storage'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = await getApp(slugify(slug))
  if (!app) {
    return new Response('Not found', { status: 404 })
  }

  // Always emit absolute https URLs — iOS's installd can't resolve a
  // server-relative path (r2AbsoluteUrl falls back to the request origin if
  // R2_PUBLIC_BASE_URL is ever unset).
  const ipaUrl = r2AbsoluteUrl(app.ipaKey, req)
  const iconUrl = app.iconKey ? r2AbsoluteUrl(app.iconKey, req) : null
  const xml = buildInstallPlist(app, ipaUrl, iconUrl)

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-store',
    },
  })
}
