import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAllPhotos, createPhoto } from "@/lib/photos";

// GET — list all photos
export async function GET() {
  const photos = await getAllPhotos();
  return Response.json(photos);
}

// POST — create a photo (admin only)
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  if (!data.url || !data.slug) {
    return Response.json({ error: "url and slug are required" }, { status: 400 });
  }

  try {
    const photo = await createPhoto(data);
    return Response.json(photo, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
