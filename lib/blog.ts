import matter from "gray-matter";
import { marked } from "marked";
import { list, put, del } from "@vercel/blob";

export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
  pinned?: boolean;
}

export async function getAllPosts(): Promise<Post[]> {
  const { blobs } = await list({ prefix: "blog/", token: process.env.BLOB_READ_WRITE_TOKEN });

  const posts: Post[] = [];
  for (const blob of blobs) {
    if (!blob.pathname.endsWith(".md")) continue;
    const slug = blob.pathname.replace("blog/", "").replace(/\.md$/, "");

    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) continue;
    const text = await res.text();
    const { data, content } = matter(text);

    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || "",
      description: data.description || "",
      content,
      pinned: data.pinned === true,
    });
  }

  return posts.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.date > b.date ? -1 : 1;
  });
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const { blobs } = await list({ prefix: `blog/${slug}.md`, token: process.env.BLOB_READ_WRITE_TOKEN });
  const blob = blobs.find((b) => b.pathname === `blog/${slug}.md`);
  if (!blob) return null;

  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  const text = await res.text();
  const { data, content } = matter(text);
  const rendered = await marked(content, { gfm: true, breaks: false });

  return {
    slug,
    title: data.title || slug,
    date: data.date || "",
    description: data.description || "",
    content: rendered,
  };
}

export async function savePost(slug: string, fileContent: string) {
  await put(`blog/${slug}.md`, fileContent, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function deletePost(slug: string) {
  const { blobs } = await list({ prefix: `blog/${slug}.md`, token: process.env.BLOB_READ_WRITE_TOKEN });
  const blob = blobs.find((b) => b.pathname === `blog/${slug}.md`);
  if (blob) {
    await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  }
}

export async function getRawPost(slug: string): Promise<{ frontmatter: Record<string, unknown>; content: string } | null> {
  const { blobs } = await list({ prefix: `blog/${slug}.md`, token: process.env.BLOB_READ_WRITE_TOKEN });
  const blob = blobs.find((b) => b.pathname === `blog/${slug}.md`);
  if (!blob) return null;

  const res = await fetch(blob.url);
  if (!res.ok) return null;
  const text = await res.text();
  const { data, content } = matter(text);
  return { frontmatter: data, content };
}
