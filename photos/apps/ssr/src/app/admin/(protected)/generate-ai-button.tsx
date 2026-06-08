'use client'

import { useCallback, useState } from 'react'

export function GenerateAIButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ updated: number; failed: number; skipped: number; total: number } | null>(null)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/photos/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
      }
    } catch {
      // ignore
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isGenerating ? 'Generating AI...' : 'Generate AI'}
      </button>
      {result && (
        <span className="text-xs text-neutral-500">
          {result.updated} updated, {result.skipped} skipped, {result.failed} failed
        </span>
      )}
    </div>
  )
}
