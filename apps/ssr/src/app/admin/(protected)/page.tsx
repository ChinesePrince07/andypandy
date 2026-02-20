import Link from 'next/link'

import { getManifest } from '~/lib/blob'

import { FixGPSButton } from './fix-gps-button'
import { PhotoGrid } from './photo-grid'

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

      <PhotoGrid initialPhotos={photos} />
    </div>
  )
}
