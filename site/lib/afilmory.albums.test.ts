import { describe, it, expect } from 'vitest'
import { keysToIds, enrichAlbum } from './afilmory'

describe('album key<->id mapping', () => {
  it('maps keys to ids deterministically', () => {
    const ids = keysToIds(['photos/original/a.jpg', 'photos/original/b.jpg'])
    expect(ids).toEqual(['a', 'b'])
  })

  it('enriches an album with photoKeys + coverKey from the manifest map', () => {
    const idToKey = new Map([
      ['id1', 'photos/original/a.jpg'],
      ['id2', 'photos/original/b.jpg'],
    ])
    const album = {
      id: 'al1', name: 'Trip', description: '', photoIds: ['id1', 'id2', 'idGone'],
      coverPhotoId: 'id2', createdAt: '2026-01-01',
    }
    const out = enrichAlbum(album, idToKey)
    expect(out.photoKeys).toEqual(['photos/original/a.jpg', 'photos/original/b.jpg']) // idGone dropped
    expect(out.coverKey).toBe('photos/original/b.jpg')
    expect(out.name).toBe('Trip')
  })

  it('null coverKey when the cover photo is missing from the map', () => {
    const out = enrichAlbum(
      { id: 'al1', name: 'X', description: '', photoIds: [], coverPhotoId: 'gone', createdAt: '' },
      new Map(),
    )
    expect(out.coverKey).toBeNull()
    expect(out.photoKeys).toEqual([])
  })
})
