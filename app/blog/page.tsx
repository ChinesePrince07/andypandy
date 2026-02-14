import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <div className="space-y-10">
      <div className="animate-fade-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Blog</h1>
        <p className="mt-3 text-gray-500">
          Thoughts, tutorials, and updates.{" "}
          <Link
            href="/feed.xml"
            className="text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-600"
          >
            Subscribe via RSS
          </Link>
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No posts yet. Check back soon!</p>
        </div>
      ) : (
        <div className="stagger space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card-hover group block rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-semibold text-gray-900 group-hover:gradient-text transition-colors">
                  {post.title}
                </h2>
                <time className="shrink-0 text-xs tabular-nums text-gray-300">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              {post.description && (
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                  {post.description}
                </p>
              )}
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-gray-600">
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
