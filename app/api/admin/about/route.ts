import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAboutData, saveAboutData } from "@/lib/about";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAboutData();
  return Response.json(data);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await saveAboutData(body);
  revalidateTag("about");
  return Response.json({ ok: true });
}
