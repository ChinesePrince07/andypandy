import { useTranslation } from 'react-i18next'

import type { PhotoManifest } from '~/types/photo'

interface ListViewProps {
  photos: PhotoManifest[]
}

export const ListView = ({ photos }: ListViewProps) => {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 lg:px-6">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  )
}

const PhotoCard = ({ photo }: { photo: PhotoManifest }) => {
  const { i18n } = useTranslation()

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // 获取相机信息
  const cameraInfo = photo.exif?.Model || photo.exif?.Make
  const lensInfo = photo.exif?.LensModel

  return (
    <div className="group flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm transition-all duration-200 hover:border-white/10 hover:bg-white/8 lg:flex-row">
      {/* 缩略图 */}
      <div className="relative h-64 w-full shrink-0 overflow-hidden rounded-lg lg:h-56 lg:w-80">
        <img
          src={photo.thumbnailUrl || photo.originalUrl}
          alt={photo.title || 'Photo'}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* 元数据 */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        {/* 标题 */}
        <div>
          <h3 className="mb-3 text-xl font-semibold text-white lg:text-2xl">{photo.title}</h3>

          {/* 元数据行 */}
          <div className="space-y-2 text-sm text-white/60">
            {/* 位置 */}
            {photo.location && (
              <div className="flex items-center gap-2">
                <i className="i-lucide-map-pin text-base" />
                <span>{photo.location.locationName}</span>
              </div>
            )}

            {/* 日期 */}
            <div className="flex items-center gap-2">
              <i className="i-lucide-calendar text-base" />
              <span>{formatDate(new Date(photo.lastModified).getTime())}</span>
            </div>

            {/* 相机 */}
            {cameraInfo && (
              <div className="flex items-center gap-2">
                <i className="i-lucide-camera text-base" />
                <span>{cameraInfo}</span>
              </div>
            )}

            {/* 镜头 */}
            {lensInfo && (
              <div className="flex items-center gap-2">
                <i className="i-lucide-aperture text-base" />
                <span>{lensInfo}</span>
              </div>
            )}
          </div>
        </div>

        {/* 标签 */}
        {photo.tags && photo.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {photo.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
