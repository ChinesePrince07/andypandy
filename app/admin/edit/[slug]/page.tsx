import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getAllPosts } from "@/lib/blog";
import EditForm from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  const { slug } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <EditForm
      slug={post.slug}
      initialTitle={post.title}
      initialDate={post.date}
      initialDescription={post.description}
      initialContent={post.content}
      initialPinned={post.pinned || false}
    />
  );
}
