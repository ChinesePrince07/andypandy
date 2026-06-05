import { NextRequest } from "next/server";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2Client as s3, R2_BUCKET as BUCKET } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

const DEPLOY_HOOK = (process.env.AFILMORY_DEPLOY_HOOK || "").trim();

async function triggerDeploy(): Promise<boolean> {
  if (!DEPLOY_HOOK) return false;
  try {
    await fetch(DEPLOY_HOOK, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

// POST — rename or move. Body: { from: string, to: string, triggerDeploy?: boolean }
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, to, triggerDeploy: shouldDeploy } = await req.json();
  if (!from || !to) {
    return Response.json({ error: "from and to required" }, { status: 400 });
  }
  if (from === to) {
    return Response.json({ error: "from and to are identical" }, { status: 400 });
  }

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: from }));
  } catch {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }

  const encodedSource = from.split("/").map(encodeURIComponent).join("/");
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      Key: to,
      CopySource: `${BUCKET}/${encodedSource}`,
    })
  );

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: from }));

  const deployTriggered = shouldDeploy === false ? false : await triggerDeploy();
  return Response.json({ from, to, deployTriggered });
}
