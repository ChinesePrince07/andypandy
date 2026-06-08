import { revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2GetText, r2Put } from "@/lib/r2-storage";
import { PINNED_KEY } from "@/lib/projects";

async function getSlugs(): Promise<string[]> {
  try {
    const text = await r2GetText(PINNED_KEY);
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch {
    return [];
  }
}

// POST — toggle pin for a project
export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, pinned } = await req.json();
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  let currentSlugs = await getSlugs();

  if (pinned) {
    if (!currentSlugs.includes(slug)) {
      currentSlugs.push(slug);
    }
  } else {
    currentSlugs = currentSlugs.filter((s) => s !== slug);
  }

  try {
    await r2Put(
      PINNED_KEY,
      JSON.stringify(currentSlugs, null, 2),
      "application/json; charset=utf-8",
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }

  revalidateTag("pinned-projects");
  return Response.json({ ok: true });
}
