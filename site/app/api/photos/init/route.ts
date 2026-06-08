import { isAdmin } from "@/lib/admin-auth";
import { initPhotosTable } from "@/lib/photos";

// POST — create the photos table (admin only, run once)
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initPhotosTable();
    return Response.json({ ok: true, message: "Photos table created" });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
