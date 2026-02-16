import { NextRequest } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return Response.json({ error: "No files" }, { status: 400 });
  }

  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: file.name,
          Body: buffer,
          ContentType: file.type,
        })
      );
      results.push({ name: file.name, ok: true });
    } catch (err) {
      results.push({ name: file.name, ok: false, error: String(err) });
    }
  }

  // Trigger afilmory rebuild
  let deployTriggered = false;
  if (DEPLOY_HOOK) {
    try {
      await fetch(DEPLOY_HOOK, { method: "POST" });
      deployTriggered = true;
    } catch {
      // non-critical
    }
  }

  return Response.json({ results, deployTriggered });
}
