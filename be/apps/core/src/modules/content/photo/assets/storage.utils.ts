import path from 'node:path'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.pjpeg': 'image/jpeg',
  '.pjp': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.hif': 'image/heic',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.mov': 'video/quicktime',
  '.qt': 'video/quicktime',
  '.mp4': 'video/mp4',
}

export function inferContentTypeFromKey(key: string): string | undefined {
  const ext = path.extname(key).toLowerCase()
  if (!ext) {
    return undefined
  }
  return MIME_MAP[ext]
}
