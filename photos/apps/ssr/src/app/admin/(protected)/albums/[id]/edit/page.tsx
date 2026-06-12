import { getManifest } from '~/lib/manifest'

import { AlbumEditor } from './album-editor'

export default async function EditAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const manifest = await getManifest()
  const album = (manifest.albums || []).find((a) => a.id === id)

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-neutral-400">Album not found</p>
      </div>
    )
  }

  // Get all photos for the photo picker
  const allPhotos = manifest.data

  return <AlbumEditor album={album} allPhotos={allPhotos} />
}
