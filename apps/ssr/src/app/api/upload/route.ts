import { PutObjectCommand,S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@env'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

async function isAdmin() {
  if (!env.ADMIN_PASSWORD) return false
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  return session?.value === env.ADMIN_PASSWORD
}

function getS3Client() {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return null
  }
  return new S3Client({
    region: 'auto',
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  })
}

// PUT — login
export async function PUT(req: NextRequest) {
  const { password } = await req.json()
  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Wrong password' }, { status: 401 })
  }
  const cookieStore = await cookies()
  cookieStore.set('admin_session', env.ADMIN_PASSWORD, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return Response.json({ ok: true })
}

// POST — get presigned upload URLs
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const s3 = getS3Client()
  if (!s3) {
    return Response.json({ error: 'S3 not configured' }, { status: 500 })
  }

  const bucket = env.S3_BUCKET_NAME || 'afilmory-photos'
  const { files, triggerDeploy } = await req.json()

  if (!files?.length) {
    return Response.json({ error: 'No files' }, { status: 400 })
  }

  const urls: { name: string; url: string }[] = []

  for (const file of files as { name: string; type: string }[]) {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: file.name,
        ContentType: file.type,
      }),
      { expiresIn: 600 },
    )
    urls.push({ name: file.name, url })
  }

  let deployTriggered = false
  if (triggerDeploy && env.DEPLOY_HOOK) {
    try {
      await fetch(env.DEPLOY_HOOK, { method: 'POST' })
      deployTriggered = true
    } catch {
      // non-critical
    }
  }

  return Response.json({ urls, deployTriggered })
}
