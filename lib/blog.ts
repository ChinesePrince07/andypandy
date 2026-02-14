import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import html from "remark-html";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "ChinesePrince07/personal-site";
const BLOG_PATH = "content/blog";

export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
}

async function githubFetch(path: string) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "personal-site",
        Accept: "application/vnd.github.v3+json",
      },
      next: { tags: ["posts"], revalidate: 60 },
    }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getAllPosts(): Promise<Post[]> {
  const files = await githubFetch(BLOG_PATH);
  if (!Array.isArray(files)) return [];

  const posts: Post[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".md")) continue;
    const slug = file.name.replace(/\.md$/, "");
    const fileData = await githubFetch(`${BLOG_PATH}/${file.name}`);
    if (!fileData?.content) continue;

    const decoded = Buffer.from(fileData.content, "base64").toString("utf8");
    const { data, content } = matter(decoded);
    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || "",
      description: data.description || "",
      content,
    });
  }

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const fileData = await githubFetch(`${BLOG_PATH}/${slug}.md`);
  if (!fileData?.content) return null;

  const decoded = Buffer.from(fileData.content, "base64").toString("utf8");
  const { data, content } = matter(decoded);
  const processed = await remark().use(remarkGfm).use(html, { sanitize: false }).process(content);
  return {
    slug,
    title: data.title || slug,
    date: data.date || "",
    description: data.description || "",
    content: processed.toString(),
  };
}
