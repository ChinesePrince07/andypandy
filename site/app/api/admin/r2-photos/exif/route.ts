import { NextRequest } from "next/server";
import exifr from "exifr";
// piexifjs has no TypeScript types and uses CommonJS — silence the import.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import piexif from "piexifjs";
import { isAdminRequest } from "@/lib/admin-auth";
import { r2Get, r2Put } from "@/lib/r2-storage";
import { updateAfilmoryPhoto, idFromKey } from "@/lib/afilmory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEPLOY_HOOK = (process.env.AFILMORY_DEPLOY_HOOK || "").trim();

async function triggerDeploy(): Promise<boolean> {
  if (!DEPLOY_HOOK) return false;
  try {
    await fetch(DEPLOY_HOOK, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

function ensureJpeg(key: string): boolean {
  return /\.jpe?g$/i.test(key);
}

// Convert decimal degrees → [[deg,1],[min,1],[sec*1e4,1e4]] rational triplet.
function toRational(value: number): [number, number][] {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = (minFull - min) * 60;
  return [
    [deg, 1],
    [min, 1],
    [Math.round(sec * 10000), 10000],
  ];
}

function fromRational(triplet: [number, number][]): number {
  const [deg, min, sec] = triplet.map(([n, d]) => (d === 0 ? 0 : n / d));
  return deg + min / 60 + sec / 3600;
}

// GET — return current EXIF fields. Query: ?key=<key>
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });

  const buf = await r2Get(key);
  if (!buf) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const parsed = await exifr.parse(buf, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "Make", "Model", "LensModel"] });
    const lat = (parsed as { latitude?: number } | undefined)?.latitude ?? null;
    const lon = (parsed as { longitude?: number } | undefined)?.longitude ?? null;
    const date = (parsed?.DateTimeOriginal || parsed?.CreateDate || parsed?.ModifyDate) as Date | undefined;
    return Response.json({
      key,
      date: date ? date.toISOString() : null,
      latitude: lat,
      longitude: lon,
      make: parsed?.Make ?? null,
      model: parsed?.Model ?? null,
      lens: parsed?.LensModel ?? null,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — rewrite EXIF date/GPS on the JPEG and replace the R2 object.
// Body: { key, date?: ISO string, latitude?: number, longitude?: number, triggerDeploy?: boolean }
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const key: string = body?.key;
  if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
  if (!ensureJpeg(key)) {
    return Response.json({ error: "EXIF editing currently supports JPEG only" }, { status: 400 });
  }

  const buf = await r2Get(key);
  if (!buf) return Response.json({ error: "Not found" }, { status: 404 });

  const binary = buf.toString("binary");
  let exif: Record<string, Record<number, unknown>>;
  try {
    exif = piexif.load(binary) as Record<string, Record<number, unknown>>;
  } catch {
    exif = { "0th": {}, Exif: {}, GPS: {}, Interop: {}, "1st": {}, thumbnail: null } as unknown as Record<string, Record<number, unknown>>;
  }
  exif["Exif"] ||= {};
  exif["GPS"] ||= {};

  // ----- Date -----
  if (body.date) {
    const d = new Date(body.date);
    if (!Number.isFinite(d.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted =
      `${d.getUTCFullYear()}:${pad(d.getUTCMonth() + 1)}:${pad(d.getUTCDate())} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    exif["Exif"][piexif.ExifIFD.DateTimeOriginal] = formatted;
    exif["Exif"][piexif.ExifIFD.DateTimeDigitized] = formatted;
    exif["0th"] = exif["0th"] || {};
    exif["0th"][piexif.ImageIFD.DateTime] = formatted;
  }

  // ----- GPS -----
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ error: "Invalid latitude/longitude" }, { status: 400 });
    }
    exif["GPS"][piexif.GPSIFD.GPSLatitude] = toRational(lat);
    exif["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
    exif["GPS"][piexif.GPSIFD.GPSLongitude] = toRational(lon);
    exif["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? "E" : "W";
  }

  let updated: Buffer;
  try {
    const exifBytes = piexif.dump(exif);
    const newBinary = piexif.insert(exifBytes, binary);
    updated = Buffer.from(newBinary, "binary");
  } catch (err) {
    return Response.json({ error: `EXIF rewrite failed: ${String(err)}` }, { status: 500 });
  }

  await r2Put(key, updated, "image/jpeg");

  // Read back to confirm.
  const verified = await exifr.parse(updated, { gps: true, pick: ["DateTimeOriginal"] }).catch(() => null);

  // Rewriting the R2 bytes alone is invisible on the live site — afilmory renders
  // date/location from its Blob manifest, not by re-reading the image. Push the
  // same edit into the manifest so the gallery actually reflects it.
  const lat = body.latitude !== undefined ? Number(body.latitude) : undefined;
  const lon = body.longitude !== undefined ? Number(body.longitude) : undefined;
  const location =
    lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: lat, longitude: lon }
      : undefined;
  const manifestUpdate = await updateAfilmoryPhoto(idFromKey(key), {
    dateTaken: body.date ?? undefined,
    location,
  });

  const deployTriggered = body?.triggerDeploy === false ? false : await triggerDeploy();
  return Response.json({
    key,
    date: verified?.DateTimeOriginal instanceof Date ? verified.DateTimeOriginal.toISOString() : null,
    latitude: fromLatlonOr(exif, "GPSLatitude", "GPSLatitudeRef"),
    longitude: fromLatlonOr(exif, "GPSLongitude", "GPSLongitudeRef"),
    deployTriggered,
    manifestUpdated: manifestUpdate.ok,
    manifestError: manifestUpdate.ok ? undefined : manifestUpdate.error,
  });
}

function fromLatlonOr(
  exif: Record<string, Record<number, unknown>>,
  coordTag: "GPSLatitude" | "GPSLongitude",
  refTag: "GPSLatitudeRef" | "GPSLongitudeRef"
): number | null {
  try {
    const gps = exif["GPS"];
    const triplet = gps?.[piexif.GPSIFD[coordTag]] as [number, number][] | undefined;
    const ref = gps?.[piexif.GPSIFD[refTag]] as string | undefined;
    if (!triplet) return null;
    const v = fromRational(triplet);
    if (ref === "S" || ref === "W") return -v;
    return v;
  } catch {
    return null;
  }
}
