"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import exifr from "exifr";
import Link from "next/link";

async function uploadToR2(file: File, key: string): Promise<{ url: string }> {
  const form = new FormData();
  // Server uses the provided key as `uploads/<safeName>`; we override by passing
  // a renamed File so the safeName matches the slugged key.
  const renamed = new File([file], key, { type: file.type });
  form.append("file", renamed);
  const res = await fetch("/api/admin/upload-blob/", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface Photo {
  id: string;
  slug: string;
  url: string;
  title: string | null;
  taken_at: string | null;
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
  width: number | null;
  height: number | null;
}

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatShutterSpeed(exposureTime: number): string {
  if (exposureTime >= 1) return String(exposureTime);
  return `1/${Math.round(1 / exposureTime)}`;
}

export default function PhotoManager() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [lens, setLens] = useState("");
  const [focalLength, setFocalLength] = useState("");
  const [aperture, setAperture] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [iso, setIso] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationName, setLocationName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Edit state
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch("/api/photos/");
    if (res.ok) setPhotos(await res.json());
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  function resetForm() {
    setTitle("");
    setTakenAt("");
    setMake("");
    setModel("");
    setLens("");
    setFocalLength("");
    setAperture("");
    setShutterSpeed("");
    setIso("");
    setLatitude("");
    setLongitude("");
    setLocationName("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setEditingSlug(null);
  }

  async function handleFileSelect(file: File) {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^.]+$/, ""));

    // Extract EXIF
    try {
      const exif = await exifr.parse(file, {
        pick: [
          "Make",
          "Model",
          "LensModel",
          "FocalLength",
          "FNumber",
          "ExposureTime",
          "ISO",
          "DateTimeOriginal",
          "ImageWidth",
          "ImageHeight",
          "ExifImageWidth",
          "ExifImageHeight",
        ],
        gps: true,
      });

      if (exif) {
        if (exif.Make) setMake(exif.Make.trim());
        if (exif.Model) setModel(exif.Model.trim());
        if (exif.LensModel) setLens(exif.LensModel.trim());
        if (exif.FocalLength)
          setFocalLength(String(Math.round(exif.FocalLength)));
        if (exif.FNumber) setAperture(String(exif.FNumber));
        if (exif.ExposureTime)
          setShutterSpeed(formatShutterSpeed(exif.ExposureTime));
        if (exif.ISO) setIso(String(exif.ISO));
        if (exif.DateTimeOriginal) {
          const d = new Date(exif.DateTimeOriginal);
          setTakenAt(d.toISOString().slice(0, 16));
        }
      }

      // Extract GPS separately — exifr.gps() is more reliable than pick
      const gps = await exifr.gps(file);
      if (gps) {
        if (
          typeof gps.latitude === "number" &&
          gps.latitude >= -90 &&
          gps.latitude <= 90
        ) {
          setLatitude(String(gps.latitude));
        }
        if (
          typeof gps.longitude === "number" &&
          gps.longitude >= -180 &&
          gps.longitude <= 180
        ) {
          setLongitude(String(gps.longitude));
        }
      }
    } catch {
      // No EXIF data — that's fine
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setMessage("");

    try {
      const slug = slugify(selectedFile.name) + "-" + Date.now().toString(36);
      const ext = selectedFile.name.split(".").pop() || "jpg";

      const blob = await uploadToR2(selectedFile, `${slug}.${ext}`);

      // Get image dimensions
      const img = new Image();
      img.src = previewUrl || blob.url;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Save metadata
      const res = await fetch("/api/photos/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          url: blob.url,
          title: title || null,
          taken_at: takenAt || null,
          width: img.naturalWidth,
          height: img.naturalHeight,
          make: make || null,
          model: model || null,
          lens: lens || null,
          focal_length: focalLength ? parseFloat(focalLength) : null,
          aperture: aperture ? parseFloat(aperture) : null,
          shutter_speed: shutterSpeed || null,
          iso: iso ? parseInt(iso) : null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          location_name: locationName || null,
          blur_data: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      } else {
        setMessage("Uploaded!");
        resetForm();
        fetchPhotos();
      }
    } catch (err) {
      setMessage(
        `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch(`/api/photos/${slug}/`, { method: "DELETE" });
    if (res.ok) fetchPhotos();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSlug) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/photos/${editingSlug}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          taken_at: takenAt || null,
          make: make || null,
          model: model || null,
          lens: lens || null,
          focal_length: focalLength ? parseFloat(focalLength) : null,
          aperture: aperture ? parseFloat(aperture) : null,
          shutter_speed: shutterSpeed || null,
          iso: iso ? parseInt(iso) : null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          location_name: locationName || null,
        }),
      });

      if (res.ok) {
        setMessage("Updated!");
        resetForm();
        fetchPhotos();
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } finally {
      setUploading(false);
    }
  }

  function startEdit(photo: Photo) {
    setEditingSlug(photo.slug);
    setTitle(photo.title || "");
    setTakenAt(
      photo.taken_at ? new Date(photo.taken_at).toISOString().slice(0, 16) : "",
    );
    setMake(photo.make || "");
    setModel(photo.model || "");
    setLens(photo.lens || "");
    setFocalLength(photo.focal_length ? String(photo.focal_length) : "");
    setAperture(photo.aperture ? String(photo.aperture) : "");
    setShutterSpeed(photo.shutter_speed || "");
    setIso(photo.iso ? String(photo.iso) : "");
    setLatitude(photo.latitude ? String(photo.latitude) : "");
    setLongitude(photo.longitude ? String(photo.longitude) : "");
    setLocationName(photo.location_name || "");
    setPreviewUrl(photo.url);
    setSelectedFile(null);
  }

  return (
    <div className="space-y-8">
      {/* Upload / Edit form */}
      <form
        onSubmit={editingSlug ? handleUpdate : handleUpload}
        className="space-y-4 rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800/80 dark:bg-gray-900"
      >
        <h2 className="text-sm font-semibold">
          {editingSlug ? `Editing: ${editingSlug}` : "Upload Photo"}
        </h2>

        {/* File drop zone (only for new uploads) */}
        {!editingSlug && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              dragOver
                ? "border-gray-900 bg-gray-50 dark:border-gray-100 dark:bg-gray-800"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-48 rounded-lg object-contain"
              />
            ) : (
              <p className="text-sm text-gray-400">
                Drop a photo here or click to select
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* Preview for editing */}
        {editingSlug && previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-48 rounded-lg object-contain"
          />
        )}

        {/* Metadata fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Photo title"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Date Taken</label>
            <input
              type="datetime-local"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Location Name</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Brooklyn, NY"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Camera Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="e.g. Sony"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Camera Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. A7III"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Lens</label>
            <input
              type="text"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="e.g. 35mm f/1.4"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Focal Length (mm)</label>
            <input
              type="number"
              value={focalLength}
              onChange={(e) => setFocalLength(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Aperture (f/)</label>
            <input
              type="number"
              step="0.1"
              value={aperture}
              onChange={(e) => setAperture(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Shutter Speed</label>
            <input
              type="text"
              value={shutterSpeed}
              onChange={(e) => setShutterSpeed(e.target.value)}
              placeholder="e.g. 1/250"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>ISO</label>
            <input
              type="number"
              value={iso}
              onChange={(e) => setIso(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Latitude</label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={uploading || (!editingSlug && !selectedFile)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {uploading ? "Saving..." : editingSlug ? "Update" : "Upload"}
          </button>
          {editingSlug && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          )}
          {message && (
            <span
              className={`text-xs ${
                message.startsWith("Error") ||
                message.startsWith("Upload failed")
                  ? "text-red-500"
                  : "text-green-600"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </form>

      {/* Photo list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">All Photos ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="text-xs text-gray-400">No photos uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-800/80 dark:bg-gray-900"
              >
                <img
                  src={photo.url}
                  alt={photo.title || photo.slug}
                  className="h-12 w-12 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {photo.title || photo.slug}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[photo.model, photo.lens].filter(Boolean).join(" · ") ||
                      "No EXIF"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/photos/${photo.slug}`}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => startEdit(photo)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(photo.slug)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
