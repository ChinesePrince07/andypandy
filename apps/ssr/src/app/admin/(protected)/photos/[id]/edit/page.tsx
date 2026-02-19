'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface PhotoData {
  id: string
  title: string
  description: string
  dateTaken: string
  tags: string[]
  thumbnailUrl: string
  originalUrl: string
  exif: {
    Make?: string
    Model?: string
    LensModel?: string
    FocalLength?: string
    FNumber?: number
    ISO?: number
    ExposureTime?: string | number
    WhiteBalance?: string
  } | null
}

export default function PhotoEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [photo, setPhoto] = useState<PhotoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dateTaken, setDateTaken] = useState('')
  const [tags, setTags] = useState('')

  // EXIF form state
  const [cameraMake, setCameraMake] = useState('')
  const [cameraModel, setCameraModel] = useState('')
  const [lensModel, setLensModel] = useState('')
  const [focalLength, setFocalLength] = useState('')
  const [fNumber, setFNumber] = useState('')
  const [iso, setIso] = useState('')
  const [exposureTime, setExposureTime] = useState('')
  const [whiteBalance, setWhiteBalance] = useState('')

  const fetchPhoto = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/photos/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Photo not found')
          return
        }
        throw new Error('Failed to fetch photo')
      }
      const data: PhotoData = await res.json()
      setPhoto(data)

      // Populate form
      setTitle(data.title || '')
      setDescription(data.description || '')
      setDateTaken(data.dateTaken ? toDatetimeLocal(data.dateTaken) : '')
      setTags((data.tags || []).join(', '))

      // Populate EXIF
      setCameraMake(data.exif?.Make || '')
      setCameraModel(data.exif?.Model || '')
      setLensModel(data.exif?.LensModel || '')
      setFocalLength(data.exif?.FocalLength || '')
      setFNumber(data.exif?.FNumber?.toString() || '')
      setIso(data.exif?.ISO?.toString() || '')
      setExposureTime(data.exif?.ExposureTime?.toString() || '')
      setWhiteBalance(data.exif?.WhiteBalance?.toString() || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photo')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPhoto()
  }, [fetchPhoto])

  function toDatetimeLocal(isoStr: string): string {
    try {
      const date = new Date(isoStr)
      // Format as YYYY-MM-DDThh:mm for datetime-local input
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const exifUpdate: Record<string, unknown> = {}
      if (cameraMake !== (photo?.exif?.Make || '')) exifUpdate.Make = cameraMake || undefined
      if (cameraModel !== (photo?.exif?.Model || '')) exifUpdate.Model = cameraModel || undefined
      if (lensModel !== (photo?.exif?.LensModel || '')) exifUpdate.LensModel = lensModel || undefined
      if (focalLength !== (photo?.exif?.FocalLength || '')) exifUpdate.FocalLength = focalLength || undefined
      if (fNumber !== (photo?.exif?.FNumber?.toString() || '')) {
        exifUpdate.FNumber = fNumber ? Number.parseFloat(fNumber) : undefined
      }
      if (iso !== (photo?.exif?.ISO?.toString() || '')) {
        exifUpdate.ISO = iso ? Number.parseInt(iso, 10) : undefined
      }
      if (exposureTime !== (photo?.exif?.ExposureTime?.toString() || '')) {
        exifUpdate.ExposureTime = exposureTime || undefined
      }
      if (whiteBalance !== (photo?.exif?.WhiteBalance?.toString() || '')) {
        exifUpdate.WhiteBalance = whiteBalance || undefined
      }

      const body: Record<string, unknown> = {
        title,
        description,
        dateTaken: dateTaken ? new Date(dateTaken).toISOString() : photo?.dateTaken,
        tags: parsedTags,
      }

      if (Object.keys(exifUpdate).length > 0) {
        body.exif = exifUpdate
      }

      const res = await fetch(`/api/admin/photos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated: PhotoData = await res.json()
      setPhoto(updated)
      setSuccess('Photo updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this photo? This action cannot be undone.',
    )
    if (!confirmed) return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/photos/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }

      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-400">Loading photo...</div>
      </div>
    )
  }

  if (error && !photo) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-4 text-red-400">{error}</p>
        <Link
          href="/admin"
          className="text-sm text-neutral-400 underline underline-offset-4 hover:text-white"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (!photo) return null

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold">Edit Photo</h1>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Photo'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-800 bg-green-950 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          {/* Left — Photo preview */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
              <div className="relative aspect-[3/2] w-full bg-neutral-800">
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.title || 'Photo preview'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
            </div>
            <div className="text-xs text-neutral-500">
              <p>ID: {photo.id}</p>
              <p className="mt-1 truncate" title={photo.originalUrl}>
                Original: {photo.originalUrl}
              </p>
            </div>
          </div>

          {/* Right — Form */}
          <div className="space-y-8">
            {/* Basic Info Section */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Basic Info</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="mb-1 block text-sm text-neutral-400">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="Photo title"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="mb-1 block text-sm text-neutral-400">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none resize-none"
                    placeholder="Photo description"
                  />
                </div>

                <div>
                  <label htmlFor="dateTaken" className="mb-1 block text-sm text-neutral-400">
                    Date Taken
                  </label>
                  <input
                    id="dateTaken"
                    type="datetime-local"
                    value={dateTaken}
                    onChange={(e) => setDateTaken(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label htmlFor="tags" className="mb-1 block text-sm text-neutral-400">
                    Tags
                  </label>
                  <input
                    id="tags"
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="landscape, sunset, mountains"
                  />
                  <p className="mt-1 text-xs text-neutral-600">Separate tags with commas</p>
                </div>
              </div>
            </section>

            {/* EXIF Section */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Camera / EXIF Data</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cameraMake" className="mb-1 block text-sm text-neutral-400">
                    Camera Make
                  </label>
                  <input
                    id="cameraMake"
                    type="text"
                    value={cameraMake}
                    onChange={(e) => setCameraMake(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. Canon"
                  />
                </div>

                <div>
                  <label htmlFor="cameraModel" className="mb-1 block text-sm text-neutral-400">
                    Camera Model
                  </label>
                  <input
                    id="cameraModel"
                    type="text"
                    value={cameraModel}
                    onChange={(e) => setCameraModel(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. EOS R5"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="lensModel" className="mb-1 block text-sm text-neutral-400">
                    Lens Model
                  </label>
                  <input
                    id="lensModel"
                    type="text"
                    value={lensModel}
                    onChange={(e) => setLensModel(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. RF 24-70mm F2.8 L IS USM"
                  />
                </div>

                <div>
                  <label htmlFor="focalLength" className="mb-1 block text-sm text-neutral-400">
                    Focal Length
                  </label>
                  <input
                    id="focalLength"
                    type="text"
                    value={focalLength}
                    onChange={(e) => setFocalLength(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. 50mm"
                  />
                </div>

                <div>
                  <label htmlFor="fNumber" className="mb-1 block text-sm text-neutral-400">
                    Aperture (f-number)
                  </label>
                  <input
                    id="fNumber"
                    type="number"
                    step="0.1"
                    value={fNumber}
                    onChange={(e) => setFNumber(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. 2.8"
                  />
                </div>

                <div>
                  <label htmlFor="iso" className="mb-1 block text-sm text-neutral-400">
                    ISO
                  </label>
                  <input
                    id="iso"
                    type="number"
                    value={iso}
                    onChange={(e) => setIso(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. 400"
                  />
                </div>

                <div>
                  <label htmlFor="exposureTime" className="mb-1 block text-sm text-neutral-400">
                    Shutter Speed
                  </label>
                  <input
                    id="exposureTime"
                    type="text"
                    value={exposureTime}
                    onChange={(e) => setExposureTime(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. 1/250"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="whiteBalance" className="mb-1 block text-sm text-neutral-400">
                    White Balance
                  </label>
                  <input
                    id="whiteBalance"
                    type="text"
                    value={whiteBalance}
                    onChange={(e) => setWhiteBalance(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                    placeholder="e.g. Auto"
                  />
                </div>
              </div>
            </section>

            {/* Submit */}
            <div className="flex items-center gap-4 border-t border-neutral-800 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href="/admin"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
