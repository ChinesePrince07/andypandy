"use client";

import { useState, useCallback, useRef } from "react";

interface UploadResult {
  name: string;
  ok: boolean;
  error?: string;
}

export default function R2Uploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter((f) =>
      /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...accepted]);
    setResults([]);
    setMessage("");
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setMessage("");
    setResults([]);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/admin/r2-upload/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.results) {
        setResults(data.results);
        const ok = data.results.filter((r: UploadResult) => r.ok).length;
        const fail = data.results.length - ok;
        setMessage(
          `${ok} uploaded${fail ? `, ${fail} failed` : ""}${data.deployTriggered ? " — rebuild triggered" : ""}`
        );
        if (fail === 0) setFiles([]);
      } else {
        setMessage(data.error || "Upload failed");
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-gray-900", "dark:border-gray-100");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-gray-900", "dark:border-gray-100");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-gray-900", "dark:border-gray-100");
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500"
      >
        <p className="text-sm text-gray-500">
          Tap to select or drag photos here
        </p>
        <p className="mt-1 text-xs text-gray-400">
          JPG, PNG, HEIC, WebP, TIFF
        </p>
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
          <p className="text-xs font-medium text-gray-500">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
              >
                <span className="truncate mr-2">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600"
                >
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
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {uploading
          ? "Uploading..."
          : `Upload ${files.length || ""} photo${files.length !== 1 ? "s" : ""}`}
      </button>

      {/* Results */}
      {message && (
        <p
          className={`text-sm ${results.some((r) => !r.ok) ? "text-red-500" : "text-green-600"}`}
        >
          {message}
        </p>
      )}

      {results.length > 0 && results.some((r) => !r.ok) && (
        <div className="space-y-1">
          {results
            .filter((r) => !r.ok)
            .map((r) => (
              <p key={r.name} className="text-xs text-red-400">
                {r.name}: {r.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
