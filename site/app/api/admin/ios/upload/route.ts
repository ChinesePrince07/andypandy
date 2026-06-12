import { NextRequest } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { r2Client as s3, R2_BUCKET as BUCKET } from '@/lib/r2-storage'
import { bearerTokenMatches, slugify } from '@/lib/ios-apps'

export const dynamic = 'force-dynamic'

const TOKEN = (process.env.IOS_UPLOAD_TOKEN || '').trim()

export async function POST(req: NextRequest) {
  if (!bearerTokenMatches(req.headers.get('authorization'), TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { slug?: string; ipaContentType?: string; iconContentType?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slug = slugify(body.slug || '')
  if (!body.slug) {
    return Response.json({ error: 'Missing slug' }, { status: 400 })
  }

  const ipaKey = `apps/${slug}/App.ipa`
  const iconKey = `apps/${slug}/icon.png`

  const ipaUploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: ipaKey, ContentType: body.ipaContentType || 'application/octet-stream' }),
    { expiresIn: 900 },
  )
  const iconUploadUrl = body.iconContentType
    ? await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: iconKey, ContentType: body.iconContentType }),
        { expiresIn: 900 },
      )
    : null

  return Response.json({ slug, ipaKey, iconKey, ipaUploadUrl, iconUploadUrl })
}
