import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotoBySlug } from "@/lib/photos";
import { isAdmin } from "@/lib/admin-auth";
import PhotoMap from "@/components/photo-map";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  if (!photo) return {};
  return { title: photo.title || photo.slug };
}

function ExifRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-gray-700 font-mono dark:text-gray-300">{value}</span>
    </div>
  );
}

export default async function PhotoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);
  if (!photo) notFound();

  const admin = await isAdmin();

  const cameraInfo = [photo.make, photo.model].filter(Boolean).join(" ");
  const exposureInfo = [
    photo.aperture ? `f/${photo.aperture}` : null,
    photo.shutter_speed ? `${photo.shutter_speed}s` : null,
    photo.iso ? `ISO ${photo.iso}` : null,
    photo.focal_length ? `${photo.focal_length}mm` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/photos"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to photos
        </Link>
        {admin && (
          <Link
            href={`/admin/photos?edit=${slug}`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Edit
          </Link>
        )}
      </div>

      {/* Photo */}
      <div className="overflow-hidden rounded-xl">
        <img
          src={photo.url}
          alt={photo.title || photo.slug}
          className="w-full rounded-xl"
        />
      </div>

      {/* Title & date */}
      {(photo.title || photo.taken_at) && (
        <div className="space-y-1">
          {photo.title && (
            <h1 className="text-2xl font-bold tracking-tight">{photo.title}</h1>
          )}
          {photo.taken_at && (
            <time className="text-sm text-gray-400 font-mono dark:text-gray-500">
              {new Date(photo.taken_at).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          )}
        </div>
      )}

      {/* Camera & exposure summary */}
      {(cameraInfo || exposureInfo) && (
        <div className="space-y-1">
          {cameraInfo && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {cameraInfo}
            </p>
          )}
          {exposureInfo && (
            <p className="text-sm text-gray-400 font-mono dark:text-gray-500">
              {exposureInfo}
            </p>
          )}
          {photo.lens && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{photo.lens}</p>
          )}
        </div>
      )}

      {/* EXIF detail panel */}
      <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2 dark:border-gray-800/80 dark:bg-gray-900">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Details
        </h3>
        <ExifRow label="Camera" value={cameraInfo || null} />
        <ExifRow label="Lens" value={photo.lens} />
        <ExifRow label="Focal Length" value={photo.focal_length ? `${photo.focal_length}mm` : null} />
        <ExifRow label="Aperture" value={photo.aperture ? `f/${photo.aperture}` : null} />
        <ExifRow label="Shutter Speed" value={photo.shutter_speed ? `${photo.shutter_speed}s` : null} />
        <ExifRow label="ISO" value={photo.iso} />
        <ExifRow label="Location" value={photo.location_name} />
        <ExifRow
          label="Dimensions"
          value={photo.width && photo.height ? `${photo.width} × ${photo.height}` : null}
        />
      </div>

      {/* Map */}
      {photo.latitude && photo.longitude && (
        <PhotoMap latitude={photo.latitude} longitude={photo.longitude} />
      )}
    </div>
  );
}
