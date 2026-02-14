import { isAdmin } from "@/lib/admin-auth";
import { getAllPosts } from "@/lib/blog";
import { getProjectsWithPins } from "@/lib/projects";
import LoginForm from "./login-form";
import PostList from "./post-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();

  if (!admin) {
    return <LoginForm />;
  }

  const posts = await getAllPosts();
  const projects = await getProjectsWithPins();

  return (
    <PostList
      posts={posts.map((p) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        description: p.description,
        pinned: p.pinned ?? false,
      }))}
      projects={projects.map((p) => ({
        slug: p.slug,
        name: p.name,
        emoji: p.emoji,
        pinned: p.pinned ?? false,
      }))}
    />
  );
}
