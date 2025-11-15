import type { PhotoSyncProgressStage, PhotoSyncStageTotals } from '../../../types'
import { STAGE_ORDER } from './constants'
import type { FileProgressEntry, ProcessingStageState } from './types'

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tiff',
  'tif',
  'heic',
  'heif',
  'hif',
  'avif',
  'raw',
  'dng',
])

const isMovFile = (name: string) => name.toLowerCase().endsWith('.mov')

const getFileExtension = (name: string) => {
  const normalized = name.toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : normalized.slice(lastDotIndex + 1)
}

const getBaseName = (name: string) => {
  const normalized = name.toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')
  return lastDotIndex === -1 ? normalized : normalized.slice(0, lastDotIndex)
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** exponent
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[exponent]}`
}

export function createFileEntries(files: File[]): FileProgressEntry[] {
  return files.map((file, index) => ({
    index,
    name: file.name,
    size: file.size,
    status: 'pending',
    uploadedBytes: 0,
    progress: 0,
  }))
}

export function createStageStateFromTotals(
  totals: PhotoSyncStageTotals,
): Record<PhotoSyncProgressStage, ProcessingStageState> {
  return STAGE_ORDER.reduce<Record<PhotoSyncProgressStage, ProcessingStageState>>(
    (acc, stage) => {
      const total = totals[stage]
      acc[stage] = {
        status: total === 0 ? 'completed' : 'pending',
        processed: 0,
        total,
      }
      return acc
    },
    {} as Record<PhotoSyncProgressStage, ProcessingStageState>,
  )
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return fallback
}

export function createFileList(fileArray: File[]): FileList {
  if (typeof DataTransfer !== 'undefined') {
    const transfer = new DataTransfer()
    fileArray.forEach((file) => transfer.items.add(file))
    return transfer.files
  }

  const fallback: Record<number, File> & { length: number; item: (index: number) => File | null } = {
    length: fileArray.length,
    item: (index: number) => fileArray[index] ?? null,
  }

  fileArray.forEach((file, index) => {
    fallback[index] = file
  })

  return fallback as unknown as FileList
}

export function sanitizeTagSegment(tag: string): string {
  if (typeof tag !== 'string') {
    return ''
  }
  const normalized = tag
    .normalize('NFKC')
    .trim()
    .replaceAll(/[\\/]+/g, '-')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\w\u00A0-\uFFFF.-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return normalized
}

export function deriveDirectoryFromTags(tags: string[]): string | null {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null
  }
  const segments = tags.map((element) => sanitizeTagSegment(element)).filter((segment) => segment.length > 0)

  if (segments.length === 0) {
    return null
  }

  return segments.join('/')
}

export function collectUnmatchedMovFiles(files: File[]) {
  const imageBaseNames = new Set(
    files.filter((file) => IMAGE_EXTENSIONS.has(getFileExtension(file.name))).map((file) => getBaseName(file.name)),
  )

  const unmatched = files.filter((file) => isMovFile(file.name) && !imageBaseNames.has(getBaseName(file.name)))

  return {
    unmatched,
    hasMov: files.some((file) => isMovFile(file.name)),
  }
}

export function calculateTotalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

export function calculateUploadedBytes(entries: FileProgressEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.min(entry.uploadedBytes, entry.size), 0)
}
