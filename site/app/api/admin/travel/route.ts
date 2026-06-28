import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getTravelData, saveTravelData, type TravelData } from "@/lib/travel";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTravelData();
  return Response.json(data);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as TravelData;
  if (!body || !Array.isArray(body.trips)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  await saveTravelData({ trips: body.trips });
  revalidateTag("travel");
  return Response.json({ ok: true });
}
