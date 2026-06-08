import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getPhotoBySlug, updatePhoto, deletePhoto } from "@/lib/photos";

// GET — single photo
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  if (!photo) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(photo);
}

// PUT — update photo metadata (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const data = await req.json();

  try {
    const photo = await updatePhoto(slug, data);
    if (!photo) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(photo);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — delete photo (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const deleted = await deletePhoto(slug);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
