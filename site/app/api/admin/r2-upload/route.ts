import { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2Client as s3, R2_BUCKET as BUCKET } from "@/lib/r2-storage";

// POST with JSON body — returns presigned URLs for each file
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { files } = await req.json();

  // An empty files array is permitted (no-op, returns no URLs).
  if (files === undefined) {
    return Response.json({ error: "Missing files array" }, { status: 400 });
  }

  const urls: { name: string; url: string }[] = [];

  for (const file of files as { name: string; type: string }[]) {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: file.name,
        ContentType: file.type,
      }),
      { expiresIn: 600 }
    );
    urls.push({ name: file.name, url });
  }

  // Note: no rebuild needed — the afilmory manifest is read from R2 at request time.
  return Response.json({ urls, deployTriggered: false });
}
