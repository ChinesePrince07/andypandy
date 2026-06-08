'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface UploadFile {
  file: File
  previewUrl: string
  status: FileStatus
  error?: string
  tags: string[]
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [batchTagInput, setBatchTagInput] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif|tiff?)$/i.test(f.name),
    )
    if (fileArray.length === 0) return

    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
      tags: [],
    }))

    setFiles((prev) => [...prev, ...uploadFiles])
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
      }
      e.target.value = ''
    },
    [addFiles],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index]
      if (file) {
        URL.revokeObjectURL(file.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
    setSelected(new Set())
  }, [])

  const toggleSelect = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const removeSelected = useCallback(() => {
    setFiles((prev) => {
      for (const i of selected) {
        if (prev[i]) URL.revokeObjectURL(prev[i].previewUrl)
      }
      return prev.filter((_, i) => !selected.has(i))
    })
    setSelected(new Set())
  }, [selected])

  const updateFileStatus = useCallback((index: number, status: FileStatus, error?: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status, error } : f)))
  }, [])

  const updateFileTags = useCallback((index: number, tags: string[]) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, tags } : f)))
  }, [])

  const applyBatchTags = useCallback(() => {
    const tags = batchTagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    if (tags.length === 0) return
    setFiles((prev) =>
      prev.map((f) => {
        if (f.status !== 'pending') return f
        const merged = Array.from(new Set([...f.tags, ...tags]))
        return { ...f, tags: merged }
      }),
    )
    setBatchTagInput('')
  }, [batchTagInput])

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true)

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i]
      if (uploadFile.status === 'done') continue

      updateFileStatus(i, 'uploading')

      try {
        // Step 1: Get a presigned R2 upload URL
        const presignRes = await fetch('/api/admin/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: uploadFile.file.name, contentType: uploadFile.file.type }),
        })
        if (!presignRes.ok) {
          const data = await presignRes.json().catch(() => ({ error: 'Failed to get upload URL' }))
          updateFileStatus(i, 'error', data.error || 'Failed to get upload URL')
          continue
        }
        const { id, key, uploadUrl } = await presignRes.json()

        // Step 2: Upload the original directly to R2 (bypasses 4.5MB serverless limit)
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: uploadFile.file,
          headers: uploadFile.file.type ? { 'Content-Type': uploadFile.file.type } : undefined,
        })
        if (!putRes.ok) {
          updateFileStatus(i, 'error', `Upload to storage failed (${putRes.status})`)
          continue
        }

        // Step 3: Process metadata server-side (EXIF, thumbnail, manifest, AI)
        const res = await fetch('/api/admin/photos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            key,
            filename: uploadFile.file.name,
            tags: uploadFile.tags.length > 0 ? uploadFile.tags : undefined,
          }),
        })

        if (res.ok) {
          updateFileStatus(i, 'done')
        } else {
          const data = await res.json().catch(() => ({ error: 'Processing failed' }))
          updateFileStatus(i, 'error', data.error || 'Processing failed')
        }
      } catch {
        updateFileStatus(i, 'error', 'Upload or processing error')
      }
    }

    setIsUploading(false)
  }, [files, updateFileStatus])

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
    setFiles([])
    setBatchTagInput('')
    setSelected(new Set())
  }, [files])

  const selectableIndices = files.reduce<number[]>((acc, f, i) => {
    if (f.status !== 'done' && f.status !== 'uploading') acc.push(i)
    return acc
  }, [])
  const allSelectable = selectableIndices.length > 0 && selectableIndices.every((i) => selected.has(i))
  const pendingCount = files.filter((f) => f.status === 'pending').length
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const allDone = files.length > 0 && pendingCount === 0 && !isUploading
  const progressPercent = files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Upload Photos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add photos to your gallery. EXIF data and AI-generated titles &amp; tags are extracted automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? 'border-white/40 bg-white/[0.03]'
            : 'border-neutral-700/60 hover:border-neutral-500/60 hover:bg-white/[0.01]'
        } ${files.length > 0 ? 'py-10' : 'py-20'}`}
      >
        <div
          className={`mb-3 rounded-2xl p-4 transition-colors ${isDragOver ? 'bg-white/10' : 'bg-neutral-800/50 group-hover:bg-neutral-800/80'}`}
        >
          <svg
            className={`h-8 w-8 transition-colors ${isDragOver ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </div>
        <p className={`text-sm font-medium transition-colors ${isDragOver ? 'text-white' : 'text-neutral-300'}`}>
          {isDragOver ? 'Drop to add photos' : 'Drop photos here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-neutral-600">JPEG, PNG, WebP, HEIC, TIFF</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-8">
          {/* Stats bar */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isUploading && selectableIndices.length > 0 && (
                <button
                  onClick={() => {
                    if (allSelectable) setSelected(new Set())
                    else setSelected(new Set(selectableIndices))
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded border border-neutral-600 transition-colors hover:border-neutral-400"
                >
                  {allSelectable && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              )}
              <span className="text-sm font-medium text-white">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${files.length} photo${files.length !== 1 ? 's' : ''}`}
              </span>
              {isUploading && (
                <span className="text-xs text-neutral-500">
                  {doneCount + 1} of {files.length}
                </span>
              )}
              {doneCount > 0 && !isUploading && selected.size === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {doneCount} uploaded
                </span>
              )}
              {errorCount > 0 && selected.size === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                  {errorCount} failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isUploading && selected.size > 0 && (
                <button
                  onClick={removeSelected}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Delete {selected.size}
                </button>
              )}
              {!isUploading && pendingCount > 0 && selected.size === 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Batch tag input */}
          {!isUploading && pendingCount > 0 && (
            <div className="mb-5 flex items-center gap-2">
              <input
                type="text"
                value={batchTagInput}
                onChange={(e) => setBatchTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyBatchTags()}
                placeholder="Add tags to all photos (comma-separated)"
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
              />
              <button
                onClick={applyBatchTags}
                disabled={!batchTagInput.trim()}
                className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-600 disabled:opacity-40"
              >
                Apply to All
              </button>
            </div>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="mb-5">
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Photo grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {files.map((uploadFile, index) => (
              <div
                key={`${uploadFile.file.name}-${index}`}
                className="group/card relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                {/* Image preview */}
                <div className="relative aspect-square overflow-hidden bg-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadFile.previewUrl}
                    alt={uploadFile.file.name}
                    className={`h-full w-full object-cover transition-all duration-300 ${
                      uploadFile.status === 'uploading' ? 'scale-105 brightness-75' : ''
                    } ${uploadFile.status === 'done' ? 'brightness-100' : ''} ${
                      uploadFile.status === 'error' ? 'brightness-50 saturate-50' : ''
                    }`}
                  />

                  {/* Status overlay */}
                  {uploadFile.status === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    </div>
                  )}
                  {uploadFile.status === 'done' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/card:opacity-100">
                      <div className="rounded-full bg-emerald-500 p-1.5">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                  {uploadFile.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="rounded-full bg-red-500 p-1.5">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Done badge */}
                  {uploadFile.status === 'done' && (
                    <div className="absolute left-2 top-2">
                      <div className="rounded-full bg-emerald-500 p-1 shadow-lg shadow-black/20">
                        <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {!isUploading && uploadFile.status !== 'done' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(index)
                      }}
                      className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border backdrop-blur-sm transition-all ${
                        selected.has(index)
                          ? 'border-white bg-white'
                          : 'border-white/50 bg-black/40 hover:border-white/80'
                      }`}
                    >
                      {selected.has(index) && (
                        <svg className="h-3 w-3 text-black" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Remove button */}
                  {!isUploading && uploadFile.status !== 'done' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(index)
                      }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:bg-red-500 hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* File info + tags */}
                <div className="px-3 py-2.5">
                  <p className="truncate text-xs font-medium text-neutral-300">{uploadFile.file.name}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-600">
                    {(uploadFile.file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  {uploadFile.error && (
                    <p className="mt-1 truncate text-[11px] text-red-400" title={uploadFile.error}>
                      {uploadFile.error}
                    </p>
                  )}
                  {/* Per-photo tags */}
                  {uploadFile.status === 'pending' && (
                    <div className="mt-2">
                      {uploadFile.tags.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {uploadFile.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                            >
                              {tag}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateFileTags(
                                    index,
                                    uploadFile.tags.filter((t) => t !== tag),
                                  )
                                }}
                                className="ml-0.5 text-neutral-600 hover:text-neutral-300"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="Tags..."
                        className="w-full rounded border border-neutral-800 bg-transparent px-2 py-1 text-[11px] text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-600"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault()
                            const val = e.currentTarget.value.trim().toLowerCase().replace(/,$/, '')
                            if (val && !uploadFile.tags.includes(val)) {
                              updateFileTags(index, [...uploadFile.tags, val])
                            }
                            e.currentTarget.value = ''
                          }
                        }}
                      />
                    </div>
                  )}
                  {/* Show tags for done/uploading photos */}
                  {uploadFile.status !== 'pending' && uploadFile.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {uploadFile.tags.map((tag) => (
                        <span key={tag} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add more button */}
            {!isUploading && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-transparent transition-colors hover:border-neutral-600 hover:bg-neutral-900/50"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <svg
                    className="h-6 w-6 text-neutral-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-xs text-neutral-600">Add more</span>
                </div>
              </button>
            )}
          </div>

          {/* Upload button */}
          {pendingCount > 0 && (
            <div className="mt-6">
              <button
                onClick={handleUploadAll}
                disabled={isUploading}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isUploading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Uploading {doneCount + 1} of {files.length}...
                  </span>
                ) : (
                  `Upload ${pendingCount} Photo${pendingCount !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}

          {/* Completion card */}
          {allDone && (
            <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold text-white">Upload Complete</p>
              <p className="mt-1 text-sm text-neutral-500">
                {doneCount} photo{doneCount !== 1 ? 's' : ''} added to your gallery
                {errorCount > 0 && <span className="text-red-400"> &middot; {errorCount} failed</span>}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/admin"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
                >
                  View Dashboard
                </Link>
                <button
                  onClick={clearAll}
                  className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Upload More
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
