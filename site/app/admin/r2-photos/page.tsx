import { isAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import R2Uploader from "./r2-uploader";

export const dynamic = "force-dynamic";

export default async function R2PhotosPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Upload Photos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload photos to R2. After uploading, the photo site will automatically
        rebuild.
      </p>
      <R2Uploader />
    </div>
  );
}
