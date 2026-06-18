import type { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { listAlbums, createAlbum } from "@/lib/afilmory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ albums: await listAlbums() });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, photoKeys, coverKey } = await req.json();
  if (!name || typeof name !== "string") {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  try {
    const album = await createAlbum({ name, description, photoKeys, coverKey });
    return Response.json(album, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
