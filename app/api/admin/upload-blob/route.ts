import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// POST multipart/form-data with a single `file` field. Returns { url, pathname }.
// Designed for native clients that can't easily run the @vercel/blob/client protocol.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const pathname = `uploads/${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: file.type || undefined,
  });

  return Response.json({ url: blob.url, pathname: blob.pathname });
}
