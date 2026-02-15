import { NextRequest } from "next/server";

const BLOB_BASE = "https://rrz9nfvwk55zvkzt.public.blob.vercel-storage.com";

// Redirect old /api/uploads/ URLs to Vercel Blob
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join("/");
  return Response.redirect(`${BLOB_BASE}/uploads/${filePath}`, 301);
}
