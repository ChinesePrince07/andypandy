"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  pinned: boolean;
}

interface ProjectItem {
  slug: string;
  name: string;
  emoji: string;
  pinned: boolean;
}

export default function PostList({
  posts,
  projects,
}: {
  posts: Post[];
  projects: ProjectItem[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingPost, setTogglingPost] = useState<string | null>(null);
  const [togglingProject, setTogglingProject] = useState<string | null>(null);

  async function handleDelete(slug: string) {
    if (!confirm(`Delete "${slug}"?`)) return;
    setDeleting(slug);

    const res = await fetch(`/api/admin/posts/${slug}/`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to delete");
    }
    setDeleting(null);
  }

  async function handleTogglePostPin(slug: string, currentlyPinned: boolean) {
    setTogglingPost(slug);
    const res = await fetch(`/api/admin/posts/${slug}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !currentlyPinned }),
    });
    if (res.ok) {
      router.refresh();
    }
    setTogglingPost(null);
  }

  async function handleToggleProjectPin(
    slug: string,
    currentlyPinned: boolean,
  ) {
    setTogglingProject(slug);
    const res = await fetch("/api/admin/projects/pin/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, pinned: !currentlyPinned }),
    });
    if (res.ok) {
      router.refresh();
    }
    setTogglingProject(null);
  }

  async function handleLogout() {
    await fetch("/api/admin/auth/", { method: "DELETE" });
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

      {/* Quick links */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/admin/r2-photos"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Upload Photos
        </Link>
        <Link
          href="/apps"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          iOS Apps
        </Link>
      </div>

      {/* Posts */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Posts
      </h2>
      <div className="space-y-3 mb-10">
        {posts.map((post) => (
          <div
            key={post.slug}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {post.pinned && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-900 shrink-0" />
                )}
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {post.title}
                </Link>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{post.date}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button
                onClick={() => handleTogglePostPin(post.slug, post.pinned)}
                disabled={togglingPost === post.slug}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  post.pinned
                    ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-700"
                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                }`}
              >
                {togglingPost === post.slug
                  ? "..."
                  : post.pinned
                    ? "Pinned"
                    : "Pin"}
              </button>
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
        {posts.length === 0 && (
          <p className="text-center text-gray-400 py-6">No posts yet.</p>
        )}
      </div>

      {/* Projects */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Projects
      </h2>
      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.slug}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {project.pinned && (
                <span className="h-1.5 w-1.5 rounded-full bg-gray-900 shrink-0" />
              )}
              <span className="text-lg">{project.emoji}</span>
              <Link
                href={`/projects/${project.slug}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {project.name}
              </Link>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button
                onClick={() =>
                  handleToggleProjectPin(project.slug, project.pinned)
                }
                disabled={togglingProject === project.slug}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  project.pinned
                    ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-700"
                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                }`}
              >
                {togglingProject === project.slug
                  ? "..."
                  : project.pinned
                    ? "Pinned"
                    : "Pin"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
