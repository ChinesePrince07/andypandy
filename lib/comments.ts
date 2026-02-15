import { list, put } from "@vercel/blob";

export interface Comment {
  id: string;
  name: string;
  text: string;
  date: string;
  parentId?: string;
}

const token = process.env.BLOB_READ_WRITE_TOKEN;

export async function getComments(slug: string): Promise<Comment[]> {
  const { blobs } = await list({ prefix: `comments/${slug}.json`, token });
  const blob = blobs.find((b) => b.pathname === `comments/${slug}.json`);
  if (!blob) return [];

  const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function addComment(
  slug: string,
  name: string,
  text: string,
  parentId?: string
): Promise<Comment> {
  const comments = await getComments(slug);
  const comment: Comment = {
    id: crypto.randomUUID(),
    name: name.trim(),
    text: text.trim(),
    date: new Date().toISOString(),
    ...(parentId ? { parentId } : {}),
  };
  comments.push(comment);
  await put(`comments/${slug}.json`, JSON.stringify(comments), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
  return comment;
}

export async function deleteComment(slug: string, id: string): Promise<boolean> {
  const comments = await getComments(slug);
  // Remove the comment and any replies to it
  const filtered = comments.filter((c) => c.id !== id && c.parentId !== id);
  if (filtered.length === comments.length) return false;
  await put(`comments/${slug}.json`, JSON.stringify(filtered), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
  return true;
}
