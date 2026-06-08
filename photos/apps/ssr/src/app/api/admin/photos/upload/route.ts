import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'
import { presignPutUrl } from '~/lib/r2'

export const dynamic = 'force-dynamic'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tiff',
}

function deriveExt(filename: string, contentType?: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]+)$/)
  if (m) return m[1].toLowerCase()
  if (contentType && EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType]
  return 'jpg'
}

// Returns a presigned PUT URL so the browser uploads the original directly to R2,
// bypassing Vercel's ~4.5MB function request-body limit.
export async function POST(req: NextRequest): Promise<Response> {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  try {
    const { filename, contentType } = (await req.json()) as {
      filename?: string
      contentType?: string
    }
    if (!filename) {
      return Response.json({ error: 'Missing filename' }, { status: 400 })
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const ext = deriveExt(filename, contentType)
    const key = `photos/original/${id}.${ext}`
    const uploadUrl = await presignPutUrl(key, 600)
    return Response.json({ id, key, uploadUrl })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create upload URL' },
      { status: 500 },
    )
  }
}
