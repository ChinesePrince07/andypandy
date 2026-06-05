"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

async function uploadToR2(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload-blob/", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface Props {
  slug: string;
  initialTitle: string;
  initialDate: string;
  initialDescription: string;
  initialContent: string;
  initialPinned: boolean;
}

function parseDate(dateStr: string) {
  if (!dateStr) return { date: "", time: "" };
  if (dateStr.includes("T")) {
    const [d, rest] = dateStr.split("T");
    return { date: d, time: rest?.replace(/Z$/, "").slice(0, 5) || "" };
  }
  if (dateStr.includes(" ") && dateStr.includes(":")) {
    const [d, t] = dateStr.split(" ");
    return { date: d, time: t.slice(0, 5) };
  }
  return { date: dateStr.slice(0, 10), time: "" };
}

function combineDateTime(date: string, time: string) {
  if (!time) return date;
  return `${date}T${time}`;
}

export default function EditForm({
  slug,
  initialTitle,
  initialDate,
  initialDescription,
  initialContent,
  initialPinned,
}: Props) {
  const parsed = parseDate(initialDate);
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [description, setDescription] = useState(initialDescription);
  const [content, setContent] = useState(initialContent);
  const [pinned, setPinned] = useState(initialPinned);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/admin/posts/${slug}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date: combineDateTime(date, time),
        description,
        content,
        pinned,
      }),
    });

    if (res.ok) {
      router.push(`/blog/${slug}`);
    } else {
      setMessage("Failed to save");
      setSaving(false);
    }
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setMessage("");

    try {
      const blob = await uploadToR2(file);

      const url = blob.url;
      const isVideo = /\.(mp4|mov|webm|ogg)$/i.test(file.name);
      const isImage = /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name);

      let markdown: string;
      if (isVideo) {
        markdown = `<video src="${url}" controls style="max-width: 50%; height: auto;"></video>`;
      } else if (isImage) {
        markdown = `<img src="${url}" alt="${file.name}" style="max-width: 50%; height: auto;" />`;
      } else {
        markdown = `[${file.name}](${url})`;
      }

      // Insert at cursor position or append
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const before = content.slice(0, start);
        const after = content.slice(ta.selectionEnd);
        const newContent = before + (before.endsWith("\n") || before === "" ? "" : "\n\n") + markdown + "\n" + after;
        setContent(newContent);
        // Restore cursor after inserted text
        requestAnimationFrame(() => {
          const pos = (before + (before.endsWith("\n") || before === "" ? "" : "\n\n") + markdown + "\n").length;
          ta.selectionStart = ta.selectionEnd = pos;
          ta.focus();
        });
      } else {
        setContent((c) => c + "\n\n" + markdown + "\n");
      }

      setMessage("Uploaded");
    } catch (err) {
      setMessage(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setUploading(false);
  }, [content]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  // Handle paste with images
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadFile(file);
          return;
        }
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Post</h1>
        <Link
          href="/admin"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Back to admin
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Pin
            </label>
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                pinned
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-400 hover:border-gray-400"
              }`}
            >
              {pinned ? "Pinned" : "Not pinned"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">
              Content (Markdown)
            </label>
            <div className="flex items-center gap-2">
              {uploading && (
                <span className="text-xs text-gray-400">Uploading...</span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-lg border transition-colors ${
              dragOver
                ? "border-gray-900 bg-gray-50"
                : "border-gray-300"
            }`}
          >
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-50/90 z-10 pointer-events-none">
                <span className="text-sm font-medium text-gray-600">Drop to upload</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              rows={20}
              className="w-full rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:border-gray-900 focus:outline-none resize-y border-0"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Drop or paste images/videos to upload. Supports jpg, png, gif, webp, mp4, mov, webm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {message && (
            <span
              className={`text-sm ${
                message === "Saved" || message === "Uploaded"
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
