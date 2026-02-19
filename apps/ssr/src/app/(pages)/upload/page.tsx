'use client'

import { useCallback, useRef, useState } from 'react'

export default function UploadPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [totalUploaded, setTotalUploaded] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const res = await fetch('/api/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setAuthError('Wrong password')
    }
  }

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const accepted = Array.from(newFiles).filter((f) => /\.(?:jpe?g|png|gif|webp|heic|heif|tiff?|bmp)$/i.test(f.name))
    setFiles((prev) => [...prev, ...accepted])
    setMessage('')
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    setMessage('')
    setProgress('Uploading...')

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Upload failed')
        return
      }

      const { ok, fail } = data
      setTotalUploaded((prev) => prev + ok)
      setMessage(`${ok} uploaded${fail ? `, ${fail} failed` : ''}`)
      if (fail === 0) setFiles([])
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const res = await fetch('/api/upload?action=rebuild', { method: 'PATCH' })
      if (res.ok) {
        setMessage('Rebuild triggered — gallery will update in ~2 minutes')
        setTotalUploaded(0)
      } else {
        setMessage('Failed to trigger rebuild')
      }
    } catch {
      setMessage('Failed to trigger rebuild')
    } finally {
      setRebuilding(false)
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <h1 className="text-center text-lg font-semibold text-white">Upload Photos</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            autoFocus
          />
          {authError && <p className="text-center text-sm text-red-400">{authError}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-center text-lg font-semibold text-white">Upload Photos</h1>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-neutral-400')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-neutral-400')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-neutral-400')
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-neutral-700 p-8 text-center transition-colors hover:border-neutral-500"
        >
          <p className="text-sm text-neutral-400">Tap to select or drag photos here</p>
          <p className="mt-1 text-xs text-neutral-500">JPG, PNG, HEIC, WebP, TIFF</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-400">
              {files.length} <span>file{files.length > 1 ? 's' : ''} selected</span>
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between rounded-lg bg-neutral-900 px-3 py-2 text-sm"
                >
                  <span className="mr-2 truncate text-neutral-300">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="shrink-0 text-xs text-red-400 hover:text-red-300">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!files.length || uploading}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          {uploading
            ? `Uploading${progress ? ` ${progress}` : '...'}`
            : `Upload ${files.length || ''} photo${files.length !== 1 ? 's' : ''}`}
        </button>

        {/* Rebuild button */}
        {totalUploaded > 0 && (
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-50"
          >
            {rebuilding ? 'Triggering rebuild...' : `Rebuild Gallery (${totalUploaded} new photo${totalUploaded !== 1 ? 's' : ''})`}
          </button>
        )}

        {/* Message */}
        {message && (
          <p
            className={`text-center text-sm ${message.includes('failed') || message.includes('Error') || message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
