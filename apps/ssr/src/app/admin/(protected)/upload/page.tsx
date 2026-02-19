'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface UploadFile {
  file: File
  previewUrl: string
  status: FileStatus
  error?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter((f) =>
      f.type.startsWith('image/'),
    )
    if (fileArray.length === 0) return

    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
    }))

    setFiles((prev) => [...prev, ...uploadFiles])
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
      }
      // Reset input so the same file can be selected again
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
  }, [])

  const updateFileStatus = useCallback(
    (index: number, status: FileStatus, error?: string) => {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status, error } : f)),
      )
    },
    [],
  )

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true)

    // Upload files sequentially (one at a time to avoid server overload)
    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i]
      if (uploadFile.status === 'done') continue

      updateFileStatus(i, 'uploading')

      const formData = new FormData()
      formData.append('file', uploadFile.file)

      try {
        const res = await fetch('/api/admin/photos/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          updateFileStatus(i, 'done')
        } else {
          const data = await res.json().catch(() => ({ error: 'Upload failed' }))
          updateFileStatus(i, 'error', data.error || 'Upload failed')
        }
      } catch {
        updateFileStatus(i, 'error', 'Network error')
      }
    }

    setIsUploading(false)
  }, [files, updateFileStatus])

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const allDone = files.length > 0 && pendingCount === 0 && !isUploading

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upload Photos</h1>
        {allDone && (
          <Link
            href="/admin"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Back to Dashboard
          </Link>
        )}
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-colors ${
          isDragOver
            ? 'border-white bg-neutral-800/50'
            : 'border-neutral-600 hover:border-neutral-400'
        }`}
      >
        <svg
          className="mb-4 h-12 w-12 text-neutral-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="mb-1 text-neutral-300">
          Drop photos here or click to select
        </p>
        <p className="text-sm text-neutral-500">
          Supports JPEG, PNG, WebP, HEIC, and other image formats
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
              {doneCount > 0 && (
                <span className="ml-2 text-green-400">
                  {doneCount} uploaded
                </span>
              )}
              {errorCount > 0 && (
                <span className="ml-2 text-red-400">
                  {errorCount} failed
                </span>
              )}
            </p>
            {!isUploading && pendingCount > 0 && (
              <button
                onClick={() => {
                  files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
                  setFiles([])
                }}
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3">
            {files.map((uploadFile, index) => (
              <div
                key={`${uploadFile.file.name}-${index}`}
                className="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3"
              >
                {/* Thumbnail preview */}
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-neutral-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadFile.previewUrl}
                    alt={uploadFile.file.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {(uploadFile.file.size / (1024 * 1024)).toFixed(1)} MB
                    {uploadFile.error && (
                      <span className="ml-2 text-red-400">
                        {uploadFile.error}
                      </span>
                    )}
                  </p>
                </div>

                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {uploadFile.status === 'pending' && (
                    <div className="h-3 w-3 rounded-full bg-neutral-600" />
                  )}
                  {uploadFile.status === 'uploading' && (
                    <svg
                      className="h-5 w-5 animate-spin text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {uploadFile.status === 'done' && (
                    <svg
                      className="h-5 w-5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {uploadFile.status === 'error' && (
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>

                {/* Remove button (only when not uploading) */}
                {!isUploading && uploadFile.status !== 'done' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="flex-shrink-0 text-neutral-600 transition-colors hover:text-neutral-300"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload button */}
          {pendingCount > 0 && (
            <button
              onClick={handleUploadAll}
              disabled={isUploading}
              className="mt-6 w-full rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading
                ? `Uploading... (${doneCount}/${files.length})`
                : `Upload ${pendingCount} Photo${pendingCount !== 1 ? 's' : ''}`}
            </button>
          )}

          {/* Results summary */}
          {allDone && (
            <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
              <p className="text-lg font-medium text-white">
                Upload Complete
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                {doneCount} photo{doneCount !== 1 ? 's' : ''} uploaded
                successfully
                {errorCount > 0 && `, ${errorCount} failed`}
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/admin"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
                >
                  View Dashboard
                </Link>
                <button
                  onClick={() => {
                    files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
                    setFiles([])
                  }}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500"
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
