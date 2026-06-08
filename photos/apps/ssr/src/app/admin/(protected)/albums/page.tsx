import Link from 'next/link'

import { getManifestSafe } from '~/lib/manifest'

import { AlbumActions } from './album-actions'

export default async function AlbumsPage() {
  const manifest = await getManifestSafe()
  const albums = manifest.albums || []

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Albums</h1>
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            {albums.length}
          </span>
        </div>
        <AlbumActions />
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20">
          <p className="mb-2 text-neutral-400">No albums yet</p>
          <p className="text-sm text-neutral-500">Create an album to organize your photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const coverPhoto = album.coverPhotoId
              ? manifest.data.find((p) => p.id === album.coverPhotoId)
              : manifest.data.find((p) => album.photoIds.includes(p.id))

            return (
              <Link
                key={album.id}
                href={`/admin/albums/${album.id}/edit`}
                className="group overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-600"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-800">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto.thumbnailUrl}
                      alt={album.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-600">
                      No cover photo
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium text-white">{album.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {album.photoIds.length} photo{album.photoIds.length !== 1 ? 's' : ''}
                  </p>
                  {album.description && <p className="mt-1 truncate text-sm text-neutral-400">{album.description}</p>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
