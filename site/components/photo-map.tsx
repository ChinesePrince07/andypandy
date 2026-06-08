"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function PhotoMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const isDark = document.documentElement.classList.contains("dark");

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: isDark
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [longitude, latitude],
      zoom: 12,
      interactive: false,
      attributionControl: false,
    });

    new maplibregl.Marker({ color: "#111" })
      .setLngLat([longitude, latitude])
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800/80">
      <div ref={mapContainer} className="h-48 w-full" />
    </div>
  );
}
