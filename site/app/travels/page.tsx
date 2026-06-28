import type { Metadata } from "next";
import TravelEditor from "@/components/travel-editor";
import {
  getTravelData,
  sortedTrips,
  travelStats,
  type Place,
  type Trip,
  type TravelDay,
} from "@/lib/travel";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travels",
  description: "Where I've been, where I stayed, and (mostly) what I ate.",
};

/* ----------------------------- date helpers ----------------------------- */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseISO(d: string | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtMonthDay(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatRange(startISO: string, endISO?: string): string {
  const s = parseISO(startISO);
  if (!s) return "";
  const e = parseISO(endISO);
  if (!e || e.getTime() === s.getTime()) {
    return `${fmtMonthDay(s)}, ${s.getFullYear()}`;
  }
  if (s.getFullYear() !== e.getFullYear()) {
    return `${fmtMonthDay(s)}, ${s.getFullYear()} – ${fmtMonthDay(e)}, ${e.getFullYear()}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${fmtMonthDay(s)} – ${fmtMonthDay(e)}, ${e.getFullYear()}`;
}

function formatDayLabel(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso || "";
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/* ------------------------------- icons --------------------------------- */

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
function BedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5v9m0-3h18m0 3v-6a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 10.5M3 13.5h.008v.008H3v-.008zm4.5-3a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
    </svg>
  );
}
function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v6.75m0 0a2.25 2.25 0 002.25-2.25V3m-4.5 0v4.5A2.25 2.25 0 008.25 9.75m0 0V21M15.75 21V3s2.25.75 2.25 4.5-2.25 4.5-2.25 4.5" />
    </svg>
  );
}
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

/* ------------------------------ subviews ------------------------------- */

function PlaceImage({
  src,
  alt,
  kind,
  className,
}: {
  src?: string;
  alt: string;
  kind: "hotel" | "restaurant";
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`object-cover ${className ?? ""}`} loading="lazy" />;
  }
  const Icon = kind === "hotel" ? BedIcon : ForkIcon;
  return (
    <div
      className={`flex items-center justify-center bg-accent/5 text-accent-strong dark:bg-accent/10 dark:text-accent ${className ?? ""}`}
    >
      <Icon className="h-6 w-6 opacity-60" />
    </div>
  );
}

function HotelRow({ hotel }: { hotel: Place }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-sm transition-colors hover:border-accent/40 dark:border-gray-800/80 dark:bg-gray-900 dark:hover:border-accent/40">
      <PlaceImage
        src={hotel.image}
        alt={hotel.name}
        kind="hotel"
        className="h-14 w-14 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-accent-strong dark:text-accent">
          <BedIcon className="h-3.5 w-3.5" />
          Stayed at
        </div>
        <h4 className="truncate font-semibold text-gray-900 dark:text-gray-100">
          {hotel.name}
        </h4>
        {hotel.note && (
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{hotel.note}</p>
        )}
      </div>
    </div>
  );
  return hotel.url ? (
    <a href={hotel.url} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function RestaurantCard({ place }: { place: Place }) {
  const inner = (
    <div className="group overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm transition-all hover:border-accent/40 hover:shadow-md dark:border-gray-800/80 dark:bg-gray-900 dark:hover:border-accent/40">
      <PlaceImage
        src={place.image}
        alt={place.name}
        kind="restaurant"
        className="h-32 w-full"
      />
      <div className="space-y-0.5 p-3">
        <h4 className="font-semibold leading-tight text-gray-900 dark:text-gray-100">
          {place.name}
        </h4>
        {place.dish && (
          <p className="flex items-start gap-1.5 text-sm text-accent-strong dark:text-accent">
            <ForkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{place.dish}</span>
          </p>
        )}
        {place.note && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{place.note}</p>
        )}
      </div>
    </div>
  );
  return place.url ? (
    <a href={place.url} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((src, i) => (
        <a
          key={i}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200/80 dark:border-gray-800/80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${alt} photo ${i + 1}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}

function DayBlock({ day, last }: { day: TravelDay; last: boolean }) {
  const restaurants = day.restaurants ?? [];
  const photos = day.photos ?? [];
  return (
    <div className="relative pl-7">
      {/* timeline rail */}
      <span
        className="absolute left-[7px] top-2 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-white dark:ring-gray-950"
        aria-hidden
      />
      {!last && (
        <span
          className="absolute left-[11px] top-5 bottom-[-1.25rem] w-px bg-gray-200 dark:bg-gray-800"
          aria-hidden
        />
      )}

      <div className="space-y-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {formatDayLabel(day.date)}
          </p>
          {day.title && (
            <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {day.title}
            </h3>
          )}
        </div>

        {day.notes && (
          <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
            {day.notes}
          </p>
        )}

        {day.hotel?.name && <HotelRow hotel={day.hotel} />}

        {restaurants.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <ForkIcon className="h-3.5 w-3.5" />
              Ate
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {restaurants.map((r, i) => (
                <RestaurantCard key={i} place={r} />
              ))}
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <CameraIcon className="h-3.5 w-3.5" />
              Photos
            </div>
            <PhotoGallery photos={photos} alt={day.title || day.date} />
          </div>
        )}
      </div>
    </div>
  );
}

function TripSection({ trip, index }: { trip: Trip; index: number }) {
  const days = [...(trip.days ?? [])].sort((a, b) =>
    (a.date || "").localeCompare(b.date || ""),
  );
  return (
    <section
      className="space-y-5 animate-fade-in"
      style={{ animationDelay: `${200 + index * 80}ms` }}
    >
      {/* Cover or header */}
      {trip.cover ? (
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 shadow-sm dark:border-gray-800/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trip.cover}
            alt={trip.title}
            className="h-52 w-full object-cover sm:h-64"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {trip.title}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-white/80">
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" />
                {trip.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatRange(trip.startDate, trip.endDate)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {trip.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 text-accent-strong dark:text-accent">
              <MapPinIcon className="h-3.5 w-3.5" />
              {trip.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formatRange(trip.startDate, trip.endDate)}
            </span>
          </div>
        </div>
      )}

      {trip.summary && (
        <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
          {trip.summary}
        </p>
      )}

      {days.length > 0 ? (
        <div className="space-y-5">
          {days.map((day, i) => (
            <DayBlock key={day.id} day={day} last={i === days.length - 1} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Day-by-day log coming soon.
        </p>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 text-center shadow-sm dark:border-gray-800/80 dark:bg-gray-900">
      <div className="font-mono text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </div>
    </div>
  );
}

/* -------------------------------- page --------------------------------- */

export default async function TravelsPage() {
  const [data, admin] = await Promise.all([getTravelData(), isAdmin()]);
  const trips = sortedTrips(data);
  const stats = travelStats(data);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <header className="hero-fx space-y-3">
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 font-mono text-xs text-gray-500 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {stats.places} {stats.places === 1 ? "place" : "places"}
            {stats.restaurants > 0 && ` · ${stats.restaurants} meals logged`}
          </span>
        </div>

        <div className="space-y-2 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ letterSpacing: "-0.04em" }}>
            Travels
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-gray-500 dark:text-gray-400">
            A running log of where I&apos;ve been, where I stayed, and (mostly)
            what I ate.
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 animate-fade-in" style={{ animationDelay: "250ms" }}>
        <Stat value={stats.trips} label="Trips" />
        <Stat value={stats.days} label="Days" />
        <Stat value={stats.restaurants} label="Eats" />
        <Stat value={stats.photos} label="Photos" />
      </div>

      <div className="divider" />

      {/* Trips */}
      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
          <MapPinIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            No trips logged yet.
          </p>
          {admin && (
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Tap the edit button to add your first trip.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {trips.map((trip, i) => (
            <TripSection key={trip.id} trip={trip} index={i} />
          ))}
        </div>
      )}

      {/* Admin editor */}
      {admin && <TravelEditor data={data} />}
    </div>
  );
}
