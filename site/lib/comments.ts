import { r2GetText, r2Put } from "./r2-storage";

export interface Comment {
  id: string;
  name: string;
  text: string;
  date: string;
  parentId?: string;
}

function keyFor(slug: string): string {
  return `comments/${slug}.json`;
}

export async function getComments(slug: string): Promise<Comment[]> {
  const text = await r2GetText(keyFor(slug));
  if (!text) return [];
  try {
    return JSON.parse(text) as Comment[];
  } catch {
    return [];
  }
}

async function saveComments(slug: string, comments: Comment[]): Promise<void> {
  await r2Put(keyFor(slug), JSON.stringify(comments), "application/json");
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
  await saveComments(slug, comments);
  return comment;
}

export async function deleteComment(slug: string, id: string): Promise<boolean> {
  const comments = await getComments(slug);
  // Remove the comment and any replies to it
  const filtered = comments.filter((c) => c.id !== id && c.parentId !== id);
  if (filtered.length === comments.length) return false;
  await saveComments(slug, filtered);
  return true;
}
