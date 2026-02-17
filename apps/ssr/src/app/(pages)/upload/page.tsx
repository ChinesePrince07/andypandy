'use client'

import { useCallback, useRef,useState } from 'react'

export default function UploadPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
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
    setProgress(`0/${files.length}`)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, type: f.type })),
          triggerDeploy: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage(data.error || 'Failed to get upload URLs')
        setUploading(false)
        return
      }

      const { urls, deployTriggered } = await res.json()

      let ok = 0
      let fail = 0

      for (const file of files) {
        const urlEntry = urls.find((u: { name: string }) => u.name === file.name)
        if (!urlEntry) {
          fail++
          continue
        }

        try {
          const uploadRes = await fetch(urlEntry.url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          })
          if (uploadRes.ok) {
            ok++
          } else {
            fail++
          }
        } catch {
          fail++
        }

        setProgress(`${ok + fail}/${files.length}`)
      }

      setMessage(`${ok} uploaded${fail ? `, ${fail} failed` : ''}${deployTriggered ? ' — rebuild triggered' : ''}`)
      if (fail === 0) setFiles([])
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
      setProgress('')
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
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
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
            ? `Uploading ${progress}...`
            : `Upload ${files.length || ''} photo${files.length !== 1 ? 's' : ''}`}
        </button>

        {/* Message */}
        {message && (
          <p
            className={`text-center text-sm ${message.includes('failed') || message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
