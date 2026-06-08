import { photoLoader } from '@afilmory/data'
import { useMemo } from 'react'
import { useParams } from 'react-router'

import { useTitle } from '~/hooks/useTitle'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { PhotosProvider } from '~/providers/photos-provider'

export const Component = () => {
  const { albumId } = useParams<{ albumId: string }>()
  const manifest = (window as any).__MANIFEST__

  const album = useMemo(() => {
    return manifest?.albums?.find((a: any) => a.id === albumId)
  }, [albumId, manifest])

  const photos = useMemo(() => {
    if (!album) return []
    const idSet = new Set(album.photoIds)
    return photoLoader.getPhotos().filter((p: any) => idSet.has(p.id))
  }, [album])

  useTitle(album?.name || 'Album')

  if (!album) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-neutral-400">Album not found</p>
      </div>
    )
  }

  return (
    <PhotosProvider photos={photos}>
      <div className="p-1 lg:px-0 lg:pb-0 mt-12">
        <div className="mb-8 px-4">
          <h2 className="text-3xl font-bold text-white">{album.name}</h2>
          {album.description && (
            <p className="mt-2 text-neutral-400">{album.description}</p>
          )}
          <p className="mt-1 text-sm text-neutral-500">{photos.length} photos</p>
        </div>
        <MasonryView photos={photos} />
      </div>
    </PhotosProvider>
  )
}
