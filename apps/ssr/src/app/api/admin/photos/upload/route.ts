import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import type { NextRequest } from 'next/server'

import { requireAdmin } from '~/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<Response> {
  const authResponse = await requireAdmin()
  if (authResponse) return authResponse

  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
          'image/tiff',
        ],
        maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
      }),
      onUploadCompleted: async () => {
        // Processing happens via separate /api/admin/photos/process call
      },
    })

    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
