import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");

  try {
    const blob = await put(`uploads/${safeName}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return Response.json({ url: blob.url, name: safeName });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
