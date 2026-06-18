import crypto from "node:crypto";

// afilmory (pics.andypandy.org) is the source of truth for what the gallery
// displays: a manifest.json in Vercel Blob holding each photo's capture date,
// dimensions, EXIF and location. The R2 bucket only holds the image bytes.
// This module bridges our R2-centric admin API to that manifest:
//   - fetchAfilmoryManifest(): read capture date + dimensions for sorting
//   - updateAfilmoryPhoto():    push date/location edits into the manifest so
//                               the live site actually reflects them
const SITE = (process.env.AFILMORY_SITE_URL || "https://pics.andypandy.org")
  .trim()
  .replace(/\/$/, "");

// afilmory's admin password. Its session cookie is a deterministic hash of it,
// so we can authenticate server-to-server without a login round-trip.
const ADMIN_PW = (process.env.AFILMORY_ADMIN_PASSWORD || "").trim();
const ADMIN_SALT = "afilmory-admin-salt"; // must match afilmory's lib/admin-auth.ts

function adminCookie(): string | null {
  if (!ADMIN_PW) return null;
  const hash = crypto
    .createHash("sha256")
    .update(`${ADMIN_SALT}:${ADMIN_PW}`)
    .digest("hex");
  return `admin_session=${hash}`;
}

export type AfilmoryManifestPhoto = {
  id: string;
  s3Key: string;
  title?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  dateTaken: string | null;
  lastModified?: string | null;
  size?: number;
  width: number;
  height: number;
  aspectRatio: number;
};

/** Derive an afilmory photo id from an R2 key: photos/original/<id>.<ext> → <id>. */
export function idFromKey(key: string): string {
  const base = key.split("/").pop() || key;
  return base.replace(/\.[^.]+$/, "");
}

// --- Albums: the app deals in photo keys; afilmory deals in photoIds. All
// key<->id mapping lives here so the iOS app never computes idFromKey itself.

export type AlbumWire = {
  id: string;
  name: string;
  description: string;
  photoIds: string[];
  coverPhotoId: string | null;
  createdAt: string;
};

export function keysToIds(keys: string[]): string[] {
  return keys.map(idFromKey);
}

/** Enrich an afilmory album with the R2 keys the app needs (photoIds it can't map). */
export function enrichAlbum(
  album: AlbumWire,
  idToKey: Map<string, string>,
): AlbumWire & { photoKeys: string[]; coverKey: string | null } {
  const photoKeys = album.photoIds
    .map((id) => idToKey.get(id))
    .filter((k): k is string => typeof k === "string");
  const coverKey = (album.coverPhotoId && idToKey.get(album.coverPhotoId)) || null;
  return { ...album, photoKeys, coverKey };
}

/**
 * Fetch afilmory's public manifest projection as a flat list (gallery order).
 * Best-effort: returns null on failure so callers can fall back gracefully.
 */
export async function fetchAfilmoryManifestList(): Promise<AfilmoryManifestPhoto[] | null> {
  try {
    const res = await fetch(`${SITE}/api/manifest`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { photos?: AfilmoryManifestPhoto[] };
    return Array.isArray(json.photos) ? json.photos : [];
  } catch {
    return null;
  }
}

/**
 * Fetch afilmory's manifest projection keyed by photo id (the key stem).
 * Best-effort: returns an empty map on any failure so the photo list still loads.
 */
export async function fetchAfilmoryManifest(): Promise<Map<string, AfilmoryManifestPhoto>> {
  const byId = new Map<string, AfilmoryManifestPhoto>();
  const list = await fetchAfilmoryManifestList();
  for (const p of list ?? []) {
    if (!p?.s3Key && !p?.id) continue;
    byId.set(p.id || idFromKey(p.s3Key), p);
  }
  return byId;
}

/**
 * Register an already-uploaded R2 original into afilmory's manifest (generates
 * thumbnail + EXIF + date) so it appears on the live gallery. Best-effort.
 */
export async function ingestAfilmoryPhoto(
  url: string,
  s3Key: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cookie = adminCookie();
  if (!cookie) return { ok: false, status: 0, error: "AFILMORY_ADMIN_PASSWORD not set" };
  try {
    const res = await fetch(`${SITE}/api/admin/photos/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ url, s3Key }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/** Remove a photo from afilmory's manifest (id = R2 key stem). Best-effort. */
export async function deleteAfilmoryPhoto(
  id: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cookie = adminCookie();
  if (!cookie) return { ok: false, status: 0, error: "AFILMORY_ADMIN_PASSWORD not set" };
  try {
    const res = await fetch(`${SITE}/api/admin/photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

/**
 * Update a photo's capture date / location in afilmory's manifest so the live
 * gallery reflects the edit. `id` is the R2 key stem. Best-effort; returns the
 * outcome so callers can surface it without failing the primary R2 write.
 */
export async function updateAfilmoryPhoto(
  id: string,
  fields: {
    dateTaken?: string | null;
    location?: { latitude: number; longitude: number } | null;
  }
): Promise<{ ok: boolean; status: number; error?: string }> {
  const cookie = adminCookie();
  if (!cookie) {
    return { ok: false, status: 0, error: "AFILMORY_ADMIN_PASSWORD not set" };
  }

  const body: Record<string, unknown> = {};
  if (fields.dateTaken) body.dateTaken = fields.dateTaken;
  if (fields.location !== undefined) body.location = fields.location;
  if (Object.keys(body).length === 0) return { ok: true, status: 0 };

  try {
    const res = await fetch(`${SITE}/api/admin/photos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}
