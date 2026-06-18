import type { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { updateAlbum, deleteAlbum } from "@/lib/afilmory";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  try {
    return Response.json(await updateAlbum(id, body));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteAlbum(id);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
