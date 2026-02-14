"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
}

export default function PostList({
  posts,
}: {
  posts: Post[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(slug: string) {
    if (!confirm(`Delete "${slug}"?`)) return;
    setDeleting(slug);

    const res = await fetch(`/api/admin/posts/${slug}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to delete");
    }
    setDeleting(null);
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.slug}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/blog/${post.slug}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {post.title}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">{post.date}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Link
                href={`/admin/edit/${post.slug}`}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(post.slug)}
                disabled={deleting === post.slug}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting === post.slug ? "..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-center text-gray-400 py-12">No posts yet.</p>
      )}
    </div>
  );
}
