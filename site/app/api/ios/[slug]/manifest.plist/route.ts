import { buildInstallPlist, getApp } from '@/lib/ios-apps'
import { r2PublicUrl } from '@/lib/r2-storage'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const app = await getApp(slug)
  if (!app) {
    return new Response('Not found', { status: 404 })
  }

  const ipaUrl = r2PublicUrl(app.ipaKey)
  const iconUrl = app.iconKey ? r2PublicUrl(app.iconKey) : null
  const xml = buildInstallPlist(app, ipaUrl, iconUrl)

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-store',
    },
  })
}
