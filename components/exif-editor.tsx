"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/photos";

function ExifRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-gray-700 font-mono dark:text-gray-300">
        {value}
      </span>
    </div>
  );
}

interface ExifEditorProps {
  photo: Photo;
  isAdmin: boolean;
}

export default function ExifEditor({ photo, isAdmin }: ExifEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(photo.title ?? "");
  const [takenAt, setTakenAt] = useState(
    photo.taken_at ? photo.taken_at.slice(0, 16) : ""
  );
  const [make, setMake] = useState(photo.make ?? "");
  const [model, setModel] = useState(photo.model ?? "");
  const [lens, setLens] = useState(photo.lens ?? "");
  const [focalLength, setFocalLength] = useState(
    photo.focal_length?.toString() ?? ""
  );
  const [aperture, setAperture] = useState(photo.aperture?.toString() ?? "");
  const [shutterSpeed, setShutterSpeed] = useState(
    photo.shutter_speed ?? ""
  );
  const [iso, setIso] = useState(photo.iso?.toString() ?? "");
  const [locationName, setLocationName] = useState(
    photo.location_name ?? ""
  );
  const [latitude, setLatitude] = useState(photo.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(
    photo.longitude?.toString() ?? ""
  );

  function resetForm() {
    setTitle(photo.title ?? "");
    setTakenAt(photo.taken_at ? photo.taken_at.slice(0, 16) : "");
    setMake(photo.make ?? "");
    setModel(photo.model ?? "");
    setLens(photo.lens ?? "");
    setFocalLength(photo.focal_length?.toString() ?? "");
    setAperture(photo.aperture?.toString() ?? "");
    setShutterSpeed(photo.shutter_speed ?? "");
    setIso(photo.iso?.toString() ?? "");
    setLocationName(photo.location_name ?? "");
    setLatitude(photo.latitude?.toString() ?? "");
    setLongitude(photo.longitude?.toString() ?? "");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title || null,
        taken_at: takenAt || null,
        make: make || null,
        model: model || null,
        lens: lens || null,
        focal_length: focalLength ? parseFloat(focalLength) : null,
        aperture: aperture ? parseFloat(aperture) : null,
        shutter_speed: shutterSpeed || null,
        iso: iso ? parseInt(iso, 10) : null,
        location_name: locationName || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      };

      const res = await fetch(`/api/photos/${photo.slug}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Save failed: ${err.error}`);
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const cameraInfo = [photo.make, photo.model].filter(Boolean).join(" ");

  if (editing) {
    return (
      <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-3 dark:border-gray-800/80 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Edit Details
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditing(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <Field label="Title" value={title} onChange={setTitle} />
        <Field
          label="Date Taken"
          value={takenAt}
          onChange={setTakenAt}
          type="datetime-local"
        />
        <Field label="Camera Make" value={make} onChange={setMake} />
        <Field label="Camera Model" value={model} onChange={setModel} />
        <Field label="Lens" value={lens} onChange={setLens} />
        <Field
          label="Focal Length (mm)"
          value={focalLength}
          onChange={setFocalLength}
          type="number"
        />
        <Field
          label="Aperture (f-stop)"
          value={aperture}
          onChange={setAperture}
          type="number"
          step="0.1"
        />
        <Field
          label="Shutter Speed"
          value={shutterSpeed}
          onChange={setShutterSpeed}
          placeholder="e.g. 1/250"
        />
        <Field
          label="ISO"
          value={iso}
          onChange={setIso}
          type="number"
        />
        <Field
          label="Location"
          value={locationName}
          onChange={setLocationName}
        />
        <Field
          label="Latitude"
          value={latitude}
          onChange={setLatitude}
          type="number"
          step="any"
        />
        <Field
          label="Longitude"
          value={longitude}
          onChange={setLongitude}
          type="number"
          step="any"
        />
      </div>
    );
  }

  // View mode
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Details
        </h3>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Edit
          </button>
        )}
      </div>
      <ExifRow label="Camera" value={cameraInfo || null} />
      <ExifRow label="Lens" value={photo.lens} />
      <ExifRow
        label="Focal Length"
        value={photo.focal_length ? `${photo.focal_length}mm` : null}
      />
      <ExifRow
        label="Aperture"
        value={photo.aperture ? `f/${photo.aperture}` : null}
      />
      <ExifRow
        label="Shutter Speed"
        value={photo.shutter_speed ? `${photo.shutter_speed}s` : null}
      />
      <ExifRow label="ISO" value={photo.iso} />
      <ExifRow label="Location" value={photo.location_name} />
      <ExifRow
        label="Dimensions"
        value={
          photo.width && photo.height
            ? `${photo.width} × ${photo.height}`
            : null
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <label className="text-gray-400 dark:text-gray-500 shrink-0">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="w-0 flex-1 text-right rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}
