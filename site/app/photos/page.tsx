import type { Metadata } from "next";
import Link from "next/link";
import { getAllPhotos } from "@/lib/photos";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photos",
};

export default async function PhotosPage() {
  const [photos, admin] = await Promise.all([getAllPhotos(), isAdmin()]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Photos
          </h1>
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            Moments captured.
          </p>
        </div>
        {admin && (
          <Link
            href="/admin/photos"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Manage
          </Link>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center dark:border-gray-800">
          <p className="text-gray-400 dark:text-gray-500">
            No photos yet.
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 gap-3 space-y-3">
          {photos.map((photo) => (
            <Link
              key={photo.id}
              href={`/photos/${photo.slug}`}
              className="group block break-inside-avoid overflow-hidden rounded-lg"
            >
              <div className="relative">
                <img
                  src={photo.url}
                  alt={photo.title || photo.slug}
                  width={photo.width || undefined}
                  height={photo.height || undefined}
                  loading="lazy"
                  className="w-full rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                  style={
                    photo.blur_data
                      ? { background: `url(${photo.blur_data}) center/cover` }
                      : undefined
                  }
                />
                <div className="absolute inset-0 rounded-lg bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <p className="text-sm font-medium text-white drop-shadow-lg truncate">
                    {photo.title || photo.slug}
                  </p>
                  {photo.model && (
                    <p className="text-xs text-white/70 drop-shadow-lg">
                      {photo.model}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
