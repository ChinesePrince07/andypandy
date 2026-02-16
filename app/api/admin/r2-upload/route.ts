import { NextRequest } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdmin } from "@/lib/admin-auth";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "afilmory-photos";
const DEPLOY_HOOK = process.env.AFILMORY_DEPLOY_HOOK || "";

// POST with JSON body — returns presigned URLs for each file
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { files, triggerDeploy } = await req.json();

  if (!files?.length) {
    return Response.json({ error: "No files" }, { status: 400 });
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

  // Trigger afilmory rebuild if requested
  let deployTriggered = false;
  if (triggerDeploy && DEPLOY_HOOK) {
    try {
      await fetch(DEPLOY_HOOK, { method: "POST" });
      deployTriggered = true;
    } catch {
      // non-critical
    }
  }

  return Response.json({ urls, deployTriggered });
}
