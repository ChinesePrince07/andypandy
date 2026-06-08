import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2AbsoluteUrl, r2Put } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

// POST multipart/form-data with a single `file` field. Returns { url, pathname }.
// Stores the file in R2 under `uploads/` and returns either the configured
// public URL or the in-app /api/uploads/ proxy URL.
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
  const key = `uploads/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2Put(key, buffer, file.type || "application/octet-stream");

  // Absolute URL so iOS / external clients can embed it as <img src> directly.
  return Response.json({ url: r2AbsoluteUrl(key, req), pathname: key });
}
