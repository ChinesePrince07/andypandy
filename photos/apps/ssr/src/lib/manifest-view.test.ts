import { describe, expect, it } from 'vitest'

import type { AfilmoryManifest, AlbumInfo, PhotoManifestItem } from '@afilmory/typing'

import { filterManifestForViewer } from './manifest-view'

function photo(id: string, overrides: Partial<PhotoManifestItem> = {}): PhotoManifestItem {
  return {
    id,
    title: id,
    description: '',
    dateTaken: '2026-06-01T00:00:00.000Z',
    tags: [],
    originalUrl: `https://r2.example/photos/original/${id}.jpg`,
    thumbnailUrl: `https://r2.example/photos/thumb/${id}.webp`,
    ogImageUrl: null,
    thumbHash: null,
    width: 100,
    height: 100,
    aspectRatio: 1,
    s3Key: `photos/original/${id}.jpg`,
    format: 'jpeg',
    size: 1,
    lastModified: '2026-06-01T00:00:00.000Z',
    exif: null,
    toneAnalysis: null,
    location: null,
    ...overrides,
  }
}

const manifest: AfilmoryManifest = {
  version: 'v10',
  data: [
    photo('pub1', { exif: { Make: 'FUJIFILM', Model: 'X-T5' } as PhotoManifestItem['exif'] }),
    photo('priv1', {
      isWorkout: true,
      exif: { Make: 'Apple', Model: 'iPhone 15', LensModel: 'iPhone lens' } as PhotoManifestItem['exif'],
    }),
  ],
  cameras: [],
  lenses: [],
  albums: [
    {
      id: 'a1',
      name: 'Album',
      description: '',
      photoIds: ['pub1', 'priv1'],
      coverPhotoId: 'priv1',
      createdAt: '2026-06-01T00:00:00.000Z',
    } satisfies AlbumInfo,
  ],
}

describe('filterManifestForViewer', () => {
  it('returns the manifest untouched for admins', () => {
    expect(filterManifestForViewer(manifest, true)).toBe(manifest)
  })

  it('removes workout photos for non-admins', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.data.map((p) => p.id)).toEqual(['pub1'])
  })

  it('rebuilds camera/lens aggregates from visible photos only', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.cameras.map((c) => c.model)).toEqual(['X-T5'])
    expect(out.lenses).toEqual([])
  })

  it('strips workout photo ids from albums', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.albums?.[0].photoIds).toEqual(['pub1'])
  })

  it('nulls out coverPhotoId when it points at a workout photo', () => {
    const out = filterManifestForViewer(manifest, false)
    expect(out.albums?.[0].coverPhotoId).toBeNull()
  })

  it('does not mutate the input manifest', () => {
    filterManifestForViewer(manifest, false)
    expect(manifest.data).toHaveLength(2)
    expect(manifest.albums?.[0].photoIds).toHaveLength(2)
    expect(manifest.albums?.[0].coverPhotoId).toBe('priv1')
  })

  it('returns a copy (not the same reference) when no photos are workout-flagged', () => {
    const allPublic: AfilmoryManifest = {
      version: 'v10',
      data: [photo('pub1')],
      cameras: [],
      lenses: [],
      albums: [
        {
          id: 'a1',
          name: 'All Public',
          description: '',
          photoIds: ['pub1'],
          coverPhotoId: 'pub1',
          createdAt: '2026-06-01T00:00:00.000Z',
        } satisfies AlbumInfo,
      ],
    }
    const out = filterManifestForViewer(allPublic, false)
    expect(out).not.toBe(allPublic)
    expect(out).toEqual(allPublic)
    expect(out.albums).not.toBe(allPublic.albums)
    expect(out.albums![0].photoIds).not.toBe(allPublic.albums![0].photoIds)
  })
})
