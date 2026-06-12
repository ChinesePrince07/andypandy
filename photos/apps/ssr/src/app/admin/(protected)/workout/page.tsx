import Link from 'next/link'

import type { PhotoManifestItem } from '@afilmory/typing'

import { getManifest } from '~/lib/manifest'

export const dynamic = 'force-dynamic'

function monthLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown date'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function WorkoutTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  const manifest = await getManifest()
  const hidden = manifest.data.filter((p) => p.isHidden)
  const allTags = Array.from(new Set(hidden.flatMap((p) => p.tags))).sort()
  const photos = tag ? hidden.filter((p) => p.tags.includes(tag)) : hidden

  // manifest.data is already sorted newest-first; group by month preserving order
  const groups: { label: string; photos: PhotoManifestItem[] }[] = []
  for (const photo of photos) {
    const label = monthLabel(photo.dateTaken)
    const last = groups.at(-1)
    if (last && last.label === label) last.photos.push(photo)
    else groups.push({ label, photos: [photo] })
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Workout Progress</h1>
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">
            {photos.length}
          </span>
        </div>
        <Link
          href="/admin/upload"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
        >
          Upload
        </Link>
      </div>

      {allTags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/admin/workout"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !tag ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={`/admin/workout?tag=${encodeURIComponent(t)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tag === t ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-12 text-center">
          <p className="text-sm text-neutral-500">
            No private photos yet. Upload one with the <span className="text-neutral-300">Private</span> toggle on.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">{group.label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {group.photos.map((photo) => (
                <Link
                  key={photo.id}
                  href={`/photos/${photo.id}`}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="truncate text-xs font-medium text-white">{photo.title}</p>
                    <p className="text-[10px] text-neutral-400">{dayLabel(photo.dateTaken)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
