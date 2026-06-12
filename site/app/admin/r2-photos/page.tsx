import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function R2PhotosPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Upload Photos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Photo uploads moved to the gallery&apos;s own admin, which extracts
        EXIF, generates thumbnails, and updates the gallery instantly — no
        rebuild needed.
      </p>
      <a
        href="https://pics.andypandy.org/admin/upload"
        className="inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Open Gallery Uploader →
      </a>
    </div>
  );
}
