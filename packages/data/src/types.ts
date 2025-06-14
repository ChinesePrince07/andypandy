import type { PickedExif } from '@afilmory/builder'

export interface PhotoManifest {
  id: string
  title: string
  description: string
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
  exif: PickedExif
  isLivePhoto?: boolean
  livePhotoVideoUrl?: string
  livePhotoVideoS3Key?: string
}
