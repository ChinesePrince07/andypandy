import { NextRequest } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

const GHOST_HEADERS = {
  "Content-Version": "v5.80",
  "X-Ghost-Version": "5.80.0",
};

function ghostError(message: string, status: number) {
  return Response.json(
    { errors: [{ message, type: "UnauthorizedError" }] },
    { status, headers: GHOST_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return ghostError("No file uploaded", 422);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");

    const blob = await put(`uploads/${safeName}`, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return Response.json(
      {
        images: [{ url: blob.url, ref: null }],
      },
      { headers: GHOST_HEADERS }
    );
  } catch (err) {
    return ghostError(String(err), 500);
  }
}
