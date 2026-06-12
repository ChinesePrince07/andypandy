import type { AfilmoryManifest, CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/typing'

export function rebuildCameras(photos: PhotoManifestItem[]): CameraInfo[] {
  const seen = new Map<string, CameraInfo>()
  for (const photo of photos) {
    const make = photo.exif?.Make
    const model = photo.exif?.Model
    if (make && model) {
      const key = `${make}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make,
          model,
          displayName: `${make} ${model}`,
        })
      }
    }
  }
  return Array.from(seen.values())
}

export function rebuildLenses(photos: PhotoManifestItem[]): LensInfo[] {
  const seen = new Map<string, LensInfo>()
  for (const photo of photos) {
    const model = photo.exif?.LensModel
    if (model) {
      const make = photo.exif?.LensMake
      const key = `${make || ''}|||${model}`
      if (!seen.has(key)) {
        seen.set(key, {
          make: make || undefined,
          model,
          displayName: make ? `${make} ${model}` : model,
        })
      }
    }
  }
  return Array.from(seen.values())
}

/**
 * Viewer-facing manifest projection. Admins see everything; everyone else
 * gets hidden photos stripped out, with camera/lens aggregates and album
 * photo lists rebuilt from the visible set so nothing leaks via counts.
 */
export function filterManifestForViewer(manifest: AfilmoryManifest, isAdmin: boolean): AfilmoryManifest {
  if (isAdmin) return manifest
  const visible = manifest.data.filter((p) => !p.isHidden)
  // Return a deep-enough copy even when nothing is hidden — callers must not
  // hold the canonical manifest reference on the viewer path, and albums/photoIds
  // arrays must also be independent so mutations don't bleed back to the input.
  if (visible.length === manifest.data.length) {
    return { ...manifest, albums: (manifest.albums ?? []).map((a) => ({ ...a, photoIds: [...a.photoIds] })) }
  }

  const visibleIds = new Set(visible.map((p) => p.id))
  return {
    ...manifest,
    data: visible,
    cameras: rebuildCameras(visible),
    lenses: rebuildLenses(visible),
    albums: (manifest.albums ?? []).map((album) => ({
      ...album,
      photoIds: album.photoIds.filter((id: string) => visibleIds.has(id)),
      coverPhotoId:
        album.coverPhotoId != null && visibleIds.has(album.coverPhotoId) ? album.coverPhotoId : null,
    })),
  }
}
