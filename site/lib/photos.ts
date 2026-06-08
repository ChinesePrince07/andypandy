import { sql } from "@vercel/postgres";
import { r2Delete } from "./r2-storage";

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");

function keyFromPhotoUrl(url: string): string | null {
  if (!url) return null;
  if (PUBLIC_BASE && url.startsWith(PUBLIC_BASE + "/")) {
    return decodeURI(url.slice(PUBLIC_BASE.length + 1));
  }
  // In-app proxy: /api/uploads/<path>/
  const proxy = url.match(/^\/?api\/uploads\/(.+?)\/?$/);
  if (proxy) return `uploads/${decodeURI(proxy[1])}`;
  return null;
}

export interface Photo {
  id: string;
  slug: string;
  url: string;
  blur_data: string | null;
  title: string | null;
  taken_at: string | null;
  uploaded_at: string;
  width: number | null;
  height: number | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  focal_length: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  iso: number | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}

export async function initPhotosTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      blur_data TEXT,
      title TEXT,
      taken_at TIMESTAMP,
      uploaded_at TIMESTAMP DEFAULT now(),
      width INT,
      height INT,
      make TEXT,
      model TEXT,
      lens TEXT,
      focal_length REAL,
      aperture REAL,
      shutter_speed TEXT,
      iso INT,
      latitude REAL,
      longitude REAL,
      location_name TEXT
    )
  `;
}

export async function getAllPhotos(): Promise<Photo[]> {
  const { rows } = await sql`
    SELECT * FROM photos ORDER BY COALESCE(taken_at, uploaded_at) DESC
  `;
  return rows as Photo[];
}

export async function getPhotoBySlug(slug: string): Promise<Photo | null> {
  const { rows } = await sql`
    SELECT * FROM photos WHERE slug = ${slug} LIMIT 1
  `;
  return (rows[0] as Photo) || null;
}

export async function createPhoto(data: Omit<Photo, "id" | "uploaded_at">): Promise<Photo> {
  const { rows } = await sql`
    INSERT INTO photos (slug, url, blur_data, title, taken_at, width, height, make, model, lens, focal_length, aperture, shutter_speed, iso, latitude, longitude, location_name)
    VALUES (${data.slug}, ${data.url}, ${data.blur_data}, ${data.title}, ${data.taken_at}, ${data.width}, ${data.height}, ${data.make}, ${data.model}, ${data.lens}, ${data.focal_length}, ${data.aperture}, ${data.shutter_speed}, ${data.iso}, ${data.latitude}, ${data.longitude}, ${data.location_name})
    RETURNING *
  `;
  return rows[0] as Photo;
}

export async function updatePhoto(slug: string, data: Partial<Omit<Photo, "id" | "uploaded_at">>): Promise<Photo | null> {
  const existing = await getPhotoBySlug(slug);
  if (!existing) return null;

  const { rows } = await sql`
    UPDATE photos SET
      title = ${data.title ?? existing.title},
      taken_at = ${data.taken_at ?? existing.taken_at},
      make = ${data.make ?? existing.make},
      model = ${data.model ?? existing.model},
      lens = ${data.lens ?? existing.lens},
      focal_length = ${data.focal_length ?? existing.focal_length},
      aperture = ${data.aperture ?? existing.aperture},
      shutter_speed = ${data.shutter_speed ?? existing.shutter_speed},
      iso = ${data.iso ?? existing.iso},
      latitude = ${data.latitude ?? existing.latitude},
      longitude = ${data.longitude ?? existing.longitude},
      location_name = ${data.location_name ?? existing.location_name}
    WHERE slug = ${slug}
    RETURNING *
  `;
  return (rows[0] as Photo) || null;
}

export async function deletePhoto(slug: string): Promise<boolean> {
  const photo = await getPhotoBySlug(slug);
  if (!photo) return false;

  const key = keyFromPhotoUrl(photo.url);
  if (key) {
    try {
      await r2Delete(key);
    } catch {
      // Orphaned object; don't block the DB delete.
    }
  }

  await sql`DELETE FROM photos WHERE slug = ${slug}`;
  return true;
}
