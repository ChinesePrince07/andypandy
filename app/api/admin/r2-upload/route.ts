import { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2Client as s3, R2_BUCKET as BUCKET } from "@/lib/r2-storage";

const DEPLOY_HOOK = (process.env.AFILMORY_DEPLOY_HOOK || "").trim();

// POST with JSON body — returns presigned URLs for each file
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { files, triggerDeploy } = await req.json();

  // Allow an empty files array if all the caller wants is to fire the deploy hook.
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
