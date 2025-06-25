import type { PhotoManifestItem } from '@afilmory/builder'

import PhotosManifest from './photos-manifest.json'

class PhotoLoader {
  private photos: PhotoManifestItem[] = []
  private photoMap: Record<string, PhotoManifestItem> = {}

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)

    this.photos = PhotosManifest.data as unknown as PhotoManifestItem[]

    this.photos.forEach((photo) => {
      this.photoMap[photo.id] = photo
    })
  }

  getPhotos() {
    return this.photos
  }

  getPhoto(id: string) {
    return this.photoMap[id]
  }

  getAllTags() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }
}
export const photoLoader = new PhotoLoader()

export type { PickedExif, ToneAnalysis } from '@afilmory/builder'
