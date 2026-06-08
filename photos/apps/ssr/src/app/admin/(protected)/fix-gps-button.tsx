'use client'

import { useCallback, useState } from 'react'

export function FixGPSButton() {
  const [isFixing, setIsFixing] = useState(false)
  const [result, setResult] = useState<{ fixed: number; failed: number; total: number } | null>(null)

  const handleFixGPS = useCallback(async () => {
    setIsFixing(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/fix-gps', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setResult({ fixed: data.fixed, failed: data.failed, total: data.total })
      }
    } catch {
      // ignore
    } finally {
      setIsFixing(false)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleFixGPS}
        disabled={isFixing}
        className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isFixing ? 'Fixing GPS...' : 'Fix GPS'}
      </button>
      {result && (
        <span className="text-xs text-neutral-500">
          {result.fixed} fixed, {result.failed} failed of {result.total}
        </span>
      )}
    </div>
  )
}
