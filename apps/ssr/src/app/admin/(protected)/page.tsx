import Image from 'next/image'
import Link from 'next/link'

import { getManifest } from '~/lib/blob'

import { FixGPSButton } from './fix-gps-button'

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
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

export default async function AdminDashboardPage() {
  const manifest = await getManifest()
  const photos = manifest.data

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Photos</h1>
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            {photos.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FixGPSButton />
          <Link
            href="/admin/upload"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
          >
            Upload Photos
          </Link>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20">
          <p className="mb-2 text-neutral-400">No photos yet</p>
          <Link href="/admin/upload" className="text-sm text-white underline underline-offset-4 hover:text-neutral-300">
            Upload your first photo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => {
            const camera = getCameraInfo(photo.exif)
            return (
              <Link
                key={photo.id}
                href={`/admin/photos/${photo.id}/edit`}
                className="group overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-600"
              >
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-neutral-800">
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.title || 'Untitled'}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
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
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
