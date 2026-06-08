'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export function AlbumActions() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (res.ok) {
        const album = await res.json()
        router.push(`/admin/albums/${album.id}/edit`)
      }
    } catch {
      // ignore
    } finally {
      setIsCreating(false)
    }
  }, [name, description, router])

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
      >
        New Album
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder="Album name"
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
        autoFocus
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder="Description (optional)"
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
      />
      <button
        onClick={handleCreate}
        disabled={isCreating || !name.trim()}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
      >
        {isCreating ? 'Creating...' : 'Create'}
      </button>
      <button
        onClick={() => {
          setShowForm(false)
          setName('')
          setDescription('')
        }}
        className="text-sm text-neutral-500 hover:text-neutral-300"
      >
        Cancel
      </button>
    </div>
  )
}
