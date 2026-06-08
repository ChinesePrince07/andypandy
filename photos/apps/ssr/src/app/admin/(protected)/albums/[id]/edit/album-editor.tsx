'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import type { AlbumInfo, PhotoManifestItem } from '@afilmory/typing'

export function AlbumEditor({
  album: initialAlbum,
  allPhotos,
}: {
  album: AlbumInfo
  allPhotos: PhotoManifestItem[]
}) {
  const router = useRouter()
  const [album, setAlbum] = useState(initialAlbum)
  const [name, setName] = useState(album.name)
  const [description, setDescription] = useState(album.description)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  const albumPhotoIds = new Set(album.photoIds)
  const albumPhotos = allPhotos.filter((p) => albumPhotoIds.has(p.id))
  const availablePhotos = allPhotos.filter((p) => !albumPhotoIds.has(p.id))

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (res.ok) {
        const updated = await res.json()
        setAlbum(updated)
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false)
    }
  }, [album.id, name, description])

  const handleAddPhotos = useCallback(
    async (photoIds: string[]) => {
      try {
        const res = await fetch(`/api/admin/albums/${album.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addPhotoIds: photoIds }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAlbum(updated)
        }
      } catch {
        // ignore
      }
    },
    [album.id],
  )

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      try {
        const res = await fetch(`/api/admin/albums/${album.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ removePhotoIds: [photoId] }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAlbum(updated)
        }
      } catch {
        // ignore
      }
    },
    [album.id],
  )

  const handleSetCover = useCallback(
    async (photoId: string) => {
      try {
        const res = await fetch(`/api/admin/albums/${album.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverPhotoId: photoId }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAlbum(updated)
        }
      } catch {
        // ignore
      }
    },
    [album.id],
  )

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/albums/${album.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/albums')
      }
    } catch {
      // ignore
    } finally {
      setIsDeleting(false)
    }
  }, [album.id, router])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Album</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:border-red-600 hover:text-red-300 disabled:opacity-40"
          >
            {isDeleting ? 'Deleting...' : 'Delete Album'}
          </button>
        </div>
      </div>

      {/* Metadata form */}
      <div className="mb-8 space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-neutral-500"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Album photos */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Photos <span className="text-neutral-500">({albumPhotos.length})</span>
        </h2>
        <button
          onClick={() => setShowPhotoPicker(!showPhotoPicker)}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
        >
          {showPhotoPicker ? 'Done' : 'Add Photos'}
        </button>
      </div>

      {/* Photo picker */}
      {showPhotoPicker && (
        <div className="mb-6 rounded-lg border border-neutral-700 bg-neutral-900/50 p-4">
          <p className="mb-3 text-sm text-neutral-400">Click photos to add them to this album</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {availablePhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handleAddPhotos([photo.id])}
                className="relative aspect-square overflow-hidden rounded-lg border border-neutral-800 transition-colors hover:border-neutral-500"
              >
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.title || 'Untitled'}
                  fill
                  className="object-cover"
                  sizes="100px"
                />
              </button>
            ))}
          </div>
          {availablePhotos.length === 0 && (
            <p className="text-sm text-neutral-500">All photos are already in this album</p>
          )}
        </div>
      )}

      {/* Current album photos grid */}
      {albumPhotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-12">
          <p className="text-neutral-400">No photos in this album</p>
          <p className="mt-1 text-sm text-neutral-500">Click &quot;Add Photos&quot; to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albumPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden bg-neutral-800">
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.title || 'Untitled'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
                {album.coverPhotoId === photo.id && (
                  <div className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black">
                    Cover
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-2">
                <p className="truncate text-xs text-neutral-400">{photo.title || 'Untitled'}</p>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleSetCover(photo.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-white"
                    title="Set as cover"
                  >
                    Cover
                  </button>
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-neutral-800 hover:text-red-400"
                    title="Remove from album"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
