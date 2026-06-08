import type { PhotoAssetManifest, photoAssets } from '@afilmory/db'

export type PhotoAssetRecord = typeof photoAssets.$inferSelect

export interface PhotoAssetListItem {
  id: string
  photoId: string
  storageKey: string
  storageProvider: string
  manifest: PhotoAssetManifest
  syncedAt: string
  updatedAt: string
  createdAt: string
  publicUrl: string | null
  size: number | null
  syncStatus: PhotoAssetRecord['syncStatus']
}

export interface PhotoAssetSummary {
  total: number
  synced: number
  conflicts: number
  pending: number
}

export interface UploadAssetInput {
  filename: string
  buffer: Buffer
  contentType?: string
  directory?: string | null
}
