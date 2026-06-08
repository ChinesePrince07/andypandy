import { redirect } from "next/navigation";
import { getPostBySlug } from "@/lib/blog";

export const dynamic = "force-dynamic";

// Catch root-level slugs (e.g. /my-post/) and redirect to /blog/my-post/
// Ghost clients construct preview URLs as site.url/slug/
export default async function SlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (post) {
    redirect(`/blog/${slug}/`);
  }

  // Not a blog post — return 404
  const { notFound } = await import("next/navigation");
  notFound();
}
