import { NextRequest } from "next/server";
import { getComments, addComment, deleteComment } from "@/lib/comments";
import { isAdmin } from "@/lib/admin-auth";

// GET — list comments for a post
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const comments = await getComments(slug);
  return Response.json(comments);
}

// POST — add a comment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { name, text, parentId } = await req.json();

  if (!name?.trim() || !text?.trim()) {
    return Response.json({ error: "Name and comment are required" }, { status: 400 });
  }

  if (name.trim().length > 50) {
    return Response.json({ error: "Name too long" }, { status: 400 });
  }

  if (text.trim().length > 2000) {
    return Response.json({ error: "Comment too long" }, { status: 400 });
  }

  const comment = await addComment(slug, name, text, parentId);
  return Response.json(comment, { status: 201 });
}

// DELETE — remove a comment (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { id } = await req.json();

  if (!id) {
    return Response.json({ error: "Comment ID required" }, { status: 400 });
  }

  const deleted = await deleteComment(slug, id);
  if (!deleted) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
