import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostBySlug } from "@/lib/blog";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const admin = await isAdmin();

  return (
    <article className="animate-fade-in">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to blog
        </Link>
        {admin && (
          <Link
            href={`/admin/edit/${slug}`}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Edit
          </Link>
        )}
      </div>

      {/* Header */}
      <header className="mt-8 space-y-3">
        <time className="text-sm text-gray-400 tabular-nums font-mono tracking-wide">
          {(() => {
            const d = new Date(post.date);
            const dateStr = d.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });
            const hasTime = post.date.includes("T") || post.date.includes(":");
            if (!hasTime) return dateStr;
            const timeStr = d.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            });
            return `${dateStr} at ${timeStr}`;
          })()}
        </time>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {post.description && (
          <p className="text-lg text-gray-500">{post.description}</p>
        )}
      </header>

      {/* Divider */}
      <div className="my-8 divider" />

      {/* Content */}
      <div
        className="prose max-w-none animate-fade-in"
        style={{ animationDelay: "200ms" }}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
