"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/admin/posts/${slug}`, {
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
      setMessage("Saved");
      router.refresh();
    } else {
      setMessage("Failed to save");
    }
    setSaving(false);
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
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Content (Markdown)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono leading-relaxed focus:border-gray-900 focus:outline-none resize-y"
          />
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
              className={`text-sm ${message === "Saved" ? "text-green-600" : "text-red-500"}`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
