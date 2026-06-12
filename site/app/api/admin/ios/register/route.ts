import { NextRequest } from 'next/server'

import { bearerTokenMatches, readAppsManifest, slugify, upsertAppEntry, writeAppsManifest, type IosApp } from '@/lib/ios-apps'

export const dynamic = 'force-dynamic'

const TOKEN = (process.env.IOS_UPLOAD_TOKEN || '').trim()

export async function POST(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<IosApp> & { hasIcon?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const required = ['slug', 'appName', 'bundleId', 'version', 'build'] as const
  for (const field of required) {
    if (typeof body[field] !== 'string' || !body[field]) {
      return Response.json({ error: `Missing field: ${field}` }, { status: 400 })
    }
  }

  const slug = slugify(body.slug as string)
  const app: IosApp = {
    slug,
    appName: body.appName as string,
    bundleId: body.bundleId as string,
    version: body.version as string,
    build: body.build as string,
    ipaKey: `apps/${slug}/App.ipa`,
    iconKey: body.hasIcon ? `apps/${slug}/icon.png` : null,
    sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : 0,
    uploadedAt: new Date().toISOString(),
  }

  const manifest = await readAppsManifest()
  await writeAppsManifest(upsertAppEntry(manifest, app))

  return Response.json({ ok: true, slug })
}

// DELETE ?slug=… — remove an app from the catalog (e.g. retire a build).
export async function DELETE(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = slugify(new URL(req.url).searchParams.get('slug') || '')
  const manifest = await readAppsManifest()
  await writeAppsManifest({ version: 1, apps: manifest.apps.filter((a) => a.slug !== slug) })
  return Response.json({ ok: true, removed: slug })
}
