import { revalidatePath, revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2GetText, r2Put } from "@/lib/r2-storage";
import { DELETED_KEY } from "@/lib/projects";

async function getSlugs(): Promise<string[]> {
  try {
    const text = await r2GetText(DELETED_KEY);
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch {
    return [];
  }
}

// POST — soft-delete (hide) or restore a project. Body: { slug, deleted }.
// Projects are source-defined, so this is a reversible R2 overlay, not a
// destructive removal (mirrors the pinned-projects mechanism).
export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, deleted } = await req.json();
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  let currentSlugs = await getSlugs();

  if (deleted) {
    if (!currentSlugs.includes(slug)) {
      currentSlugs.push(slug);
    }
  } else {
    currentSlugs = currentSlugs.filter((s) => s !== slug);
  }

  try {
    await r2Put(
      DELETED_KEY,
      JSON.stringify(currentSlugs, null, 2),
      "application/json; charset=utf-8",
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }

  revalidateTag("deleted-projects");
  revalidatePath("/projects");
  return Response.json({ ok: true });
}
