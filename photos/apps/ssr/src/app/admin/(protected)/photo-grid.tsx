'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'

import type { PhotoManifestItem } from '@afilmory/typing'

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateString
  }
}

function getCameraInfo(exif: { Make?: string; Model?: string } | null): string | null {
  if (!exif) return null
  const parts: string[] = []
  if (exif.Make) parts.push(exif.Make)
  if (exif.Model) parts.push(exif.Model)
  return parts.length > 0 ? parts.join(' ') : null
}

export function PhotoGrid({ initialPhotos }: { initialPhotos: PhotoManifestItem[] }) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [albums, setAlbums] = useState<Array<{ id: string; name: string }>>([])
  const [showAlbumPicker, setShowAlbumPicker] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const lastClickedIndex = useRef<number | null>(null)

  const toggleSelect = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev)

        if (shiftKey && lastClickedIndex.current !== null) {
          // Range select
          const start = Math.min(lastClickedIndex.current, index)
          const end = Math.max(lastClickedIndex.current, index)
          for (let i = start; i <= end; i++) {
            next.add(photos[i].id)
          }
        } else {
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
        }

        return next
      })
      lastClickedIndex.current = index
      if (!selectionMode) setSelectionMode(true)
    },
    [photos, selectionMode],
  )

  const selectAll = useCallback(() => {
    setSelected(new Set(photos.map((p) => p.id)))
  }, [photos])

  const deselectAll = useCallback(() => {
    setSelected(new Set())
    setSelectionMode(false)
  }, [])

  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/admin/photos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => !selected.has(p.id)))
        setSelected(new Set())
        setSelectionMode(false)
      }
    } catch {
      // ignore
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [selected])

  const handleBulkAddTags = useCallback(async () => {
    if (!tagValue.trim()) return
    setIsUpdating(true)
    const tags = tagValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    try {
      const res = await fetch('/api/admin/photos/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), updates: { addTags: tags } }),
      })
      if (res.ok) {
        // Update local state
        setPhotos((prev) =>
          prev.map((p) => {
            if (!selected.has(p.id)) return p
            const existing = new Set(p.tags || [])
            tags.forEach((t) => existing.add(t))
            return { ...p, tags: Array.from(existing) }
          }),
        )
        setTagValue('')
        setShowTagInput(false)
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(false)
    }
  }, [selected, tagValue])

  const handleShowAlbumPicker = useCallback(async () => {
    if (albums.length === 0) {
      try {
        const res = await fetch('/api/admin/albums')
        if (res.ok) {
          const data = await res.json()
          setAlbums(data)
        }
      } catch {}
    }
    setShowAlbumPicker(!showAlbumPicker)
  }, [albums.length, showAlbumPicker])

  const handleAddToAlbum = useCallback(
    async (albumId: string) => {
      try {
        const res = await fetch(`/api/admin/albums/${albumId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addPhotoIds: Array.from(selected) }),
        })
        if (res.ok) {
          setShowAlbumPicker(false)
          setSelected(new Set())
          setSelectionMode(false)
        }
      } catch {}
    },
    [selected],
  )

  const handleBulkGenerateAI = useCallback(async () => {
    setIsGeneratingAI(true)
    try {
      const res = await fetch('/api/admin/photos/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), overwrite: true }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.updated > 0) {
          window.location.reload()
        }
      }
    } catch {}
    setIsGeneratingAI(false)
  }, [selected])

  const isAllSelected = photos.length > 0 && selected.size === photos.length

  return (
    <>
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20">
          <p className="mb-2 text-neutral-400">No photos yet</p>
          <Link href="/admin/upload" className="text-sm text-white underline underline-offset-4 hover:text-neutral-300">
            Upload your first photo
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={isAllSelected ? deselectAll : selectAll}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            {selected.size > 0 && <span className="text-xs text-neutral-500">{selected.size} selected</span>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => {
              const camera = getCameraInfo(photo.exif)
              const isSelected = selected.has(photo.id)

              return (
                <div
                  key={photo.id}
                  className={`group/card relative overflow-hidden rounded-lg border bg-neutral-900 transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500/50'
                      : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleSelect(photo.id, index, e.shiftKey)
                    }}
                    className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-neutral-500 bg-neutral-800/80 backdrop-blur-sm'
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Photo card - link or select based on mode */}
                  {selectionMode ? (
                    <div className="cursor-pointer" onClick={(e) => toggleSelect(photo.id, index, e.shiftKey)}>
                      <div className="relative aspect-[3/2] w-full overflow-hidden bg-neutral-800">
                        <Image
                          src={photo.thumbnailUrl}
                          alt={photo.title || 'Untitled'}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-white">{photo.title || 'Untitled'}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                          {photo.dateTaken && <span>{formatDate(photo.dateTaken)}</span>}
                          {photo.dateTaken && camera && <span className="text-neutral-700">&middot;</span>}
                          {camera && <span className="truncate">{camera}</span>}
                        </div>
                        {photo.tags && photo.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {photo.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                              >
                                {tag}
                              </span>
                            ))}
                            {photo.tags.length > 3 && (
                              <span className="text-[10px] text-neutral-600">+{photo.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Link href={`/admin/photos/${photo.id}/edit`}>
                      <div className="relative aspect-[3/2] w-full overflow-hidden bg-neutral-800">
                        <Image
                          src={photo.thumbnailUrl}
                          alt={photo.title || 'Untitled'}
                          fill
                          className="object-cover transition-transform group-hover/card:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-white">{photo.title || 'Untitled'}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                          {photo.dateTaken && <span>{formatDate(photo.dateTaken)}</span>}
                          {photo.dateTaken && camera && <span className="text-neutral-700">&middot;</span>}
                          {camera && <span className="truncate">{camera}</span>}
                        </div>
                        {photo.tags && photo.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {photo.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                              >
                                {tag}
                              </span>
                            ))}
                            {photo.tags.length > 3 && (
                              <span className="text-[10px] text-neutral-600">+{photo.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-900/95 px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-sm">
            <span className="text-sm font-medium text-white">{selected.size} selected</span>
            <div className="h-4 w-px bg-neutral-700" />
            <button
              onClick={isAllSelected ? deselectAll : selectAll}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            <div className="h-4 w-px bg-neutral-700" />
            <button
              onClick={() => setShowTagInput(!showTagInput)}
              disabled={isUpdating}
              className="text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Add Tags
            </button>
            <button
              onClick={handleShowAlbumPicker}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Album
            </button>
            <button
              onClick={handleBulkGenerateAI}
              disabled={isGeneratingAI}
              className="text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {isGeneratingAI ? 'AI...' : 'AI'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
            >
              Delete
            </button>
            <button onClick={deselectAll} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
              Cancel
            </button>
          </div>

          {/* Tag input popover */}
          {showTagInput && (
            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBulkAddTags()}
                  placeholder="tag1, tag2, tag3"
                  className="w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
                  autoFocus
                />
                <button
                  onClick={handleBulkAddTags}
                  disabled={isUpdating || !tagValue.trim()}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
                >
                  {isUpdating ? '...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* Album picker popover */}
          {showAlbumPicker && (
            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
              <div className="flex flex-col gap-1">
                {albums.length === 0 ? (
                  <p className="text-xs text-neutral-500 px-2 py-1">No albums yet</p>
                ) : (
                  albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => handleAddToAlbum(album.id)}
                      className="rounded-lg px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                      {album.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h3 className="text-lg font-semibold text-white">Delete {selected.size} photos?</h3>
            <p className="mt-2 text-sm text-neutral-400">
              This will permanently delete the selected photos and their files. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-40"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
