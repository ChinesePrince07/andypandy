import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog",
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="space-y-10">
      <div className="animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Blog</h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400">
          Thoughts, tutorials, and updates.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-dashed border-gray-200 p-12 text-center dark:border-gray-800">
          <p className="text-gray-400 dark:text-gray-500">
            No posts yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="stagger space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card-hover group block rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800/80 dark:bg-gray-900"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {post.pinned && (
                    <span className="pinned-badge shrink-0">
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"
                        />
                      </svg>
                      Pinned
                    </span>
                  )}
                  <h2 className="font-semibold text-gray-900 group-hover:gradient-text transition-colors truncate dark:text-gray-100">
                    {post.title}
                  </h2>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-gray-300 font-mono dark:text-gray-600">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    year: "2-digit",
                  })}
                </time>
              </div>
              {post.description && (
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed dark:text-gray-400">
                  {post.description}
                </p>
              )}
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300">
                Read more
                <svg
                  className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
