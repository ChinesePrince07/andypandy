import type { PhotoManifestItem } from '@afilmory/builder'

class PhotoLoader {
  private photos: PhotoManifestItem[] = []
  private photoMap: Record<string, PhotoManifestItem> = {}

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)

    this.photos = __MANIFEST__.data as unknown as PhotoManifestItem[]

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

  getAllEquipmentTags() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      if (photo.equipmentTags) {
        photo.equipmentTags.forEach((tag) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  }

  // 获取所有标签（包括显示标签和设备标签，用于筛选）
  getAllTagsForFiltering() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
      if (photo.equipmentTags) {
        photo.equipmentTags.forEach((tag) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  }
}
export const photoLoader = new PhotoLoader()
