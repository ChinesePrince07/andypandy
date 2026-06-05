import matter from "gray-matter";
import { marked } from "marked";
import { r2Delete, r2GetText, r2List, r2Put } from "./r2-storage";

export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
  pinned?: boolean;
}

const BLOG_PREFIX = "blog/";

function keyFor(slug: string): string {
  return `${BLOG_PREFIX}${slug}.md`;
}

function slugFromKey(key: string): string | null {
  if (!key.startsWith(BLOG_PREFIX) || !key.endsWith(".md")) return null;
  return key.slice(BLOG_PREFIX.length, -3);
}

export async function getAllPosts(): Promise<Post[]> {
  const objects = await r2List(BLOG_PREFIX);
  const posts: Post[] = [];

  for (const obj of objects) {
    const slug = obj.Key ? slugFromKey(obj.Key) : null;
    if (!slug) continue;

    const text = await r2GetText(obj.Key!);
    if (!text) continue;

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
  const text = await r2GetText(keyFor(slug));
  if (!text) return null;

  const { data, content } = matter(text);
  const renderer = new marked.Renderer();
  renderer.image = ({ href, title, text }) => {
    const isVideo = /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(href || "");
    if (isVideo) {
      return `<video src="${href}" controls style="max-width: 50%; height: auto;"></video>`;
    }
    const alt = text ? ` alt="${text}"` : "";
    const t = title ? ` title="${title}"` : "";
    return `<img src="${href}"${alt}${t} style="max-width: 50%; height: auto;" />`;
  };
  const rendered = await marked(content, {
    gfm: true,
    breaks: false,
    renderer,
  });

  return {
    slug,
    title: data.title || slug,
    date: data.date || "",
    description: data.description || "",
    content: rendered,
  };
}

export async function savePost(slug: string, fileContent: string) {
  await r2Put(keyFor(slug), fileContent, "text/markdown; charset=utf-8");
}

export async function deletePost(slug: string) {
  await r2Delete(keyFor(slug));
}

export async function getRawPost(
  slug: string,
): Promise<{ frontmatter: Record<string, unknown>; content: string } | null> {
  const text = await r2GetText(keyFor(slug));
  if (!text) return null;
  const { data, content } = matter(text);
  return { frontmatter: data, content };
}
