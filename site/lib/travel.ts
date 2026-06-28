import { unstable_cache } from "next/cache";
import { r2GetText, r2Put } from "./r2-storage";

const TRAVEL_KEY = "content/travel.json";

/** A restaurant you ate at or a hotel you stayed in. */
export interface Place {
  name: string;
  /** For restaurants: the dish(es) you had. */
  dish?: string;
  /** Photo of the place (uploaded or pasted URL). */
  image?: string;
  /** Free-form note / quick rating. */
  note?: string;
  /** Maps or website link. */
  url?: string;
}

export interface TravelDay {
  id: string;
  /** ISO date, e.g. "2025-07-09". */
  date: string;
  /** Short headline for the day. */
  title?: string;
  /** What you did / where you went. */
  notes?: string;
  /** Where you stayed that night. */
  hotel?: Place;
  /** What you ate. */
  restaurants: Place[];
  /** Your own uploaded photos (URLs). */
  photos: string[];
}

export interface Trip {
  id: string;
  title: string;
  location: string;
  /** ISO date the trip started. */
  startDate: string;
  /** ISO date the trip ended (optional for single-day trips). */
  endDate?: string;
  /** Hero / cover image URL. */
  cover?: string;
  /** Short blurb about the trip. */
  summary?: string;
  days: TravelDay[];
}

export interface TravelData {
  trips: Trip[];
}

const defaultTravel: TravelData = {
  trips: [
    {
      id: "costa-rica-2025",
      title: "Costa Rica",
      location: "Costa Rica",
      startDate: "2025-07-08",
      endDate: "2025-07-15",
      cover: "",
      summary:
        "A week of volcanoes, rainforest, and way too much good food. Pura vida.",
      days: [],
    },
    {
      id: "california-2025",
      title: "A Summer in California",
      location: "California, USA",
      startDate: "2025-08-10",
      endDate: "2025-08-20",
      cover: "",
      summary: "Sun, family, and eating my way down the coast.",
      days: [],
    },
  ],
};

const loadTravel = unstable_cache(
  async (): Promise<TravelData> => {
    try {
      const text = await r2GetText(TRAVEL_KEY);
      if (!text) return defaultTravel;
      const parsed = JSON.parse(text) as TravelData;
      // Be tolerant of partially-shaped data saved by older editors.
      return { trips: Array.isArray(parsed.trips) ? parsed.trips : [] };
    } catch {
      return defaultTravel;
    }
  },
  ["travel-data"],
  { tags: ["travel"], revalidate: 60 },
);

export async function getTravelData(): Promise<TravelData> {
  return loadTravel();
}

export async function saveTravelData(data: TravelData): Promise<void> {
  await r2Put(
    TRAVEL_KEY,
    JSON.stringify(data, null, 2),
    "application/json; charset=utf-8",
  );
}

/** Newest-trip-first, for display. Sorts on a copy. */
export function sortedTrips(data: TravelData): Trip[] {
  return [...data.trips].sort((a, b) =>
    (b.startDate || "").localeCompare(a.startDate || ""),
  );
}

/** Aggregate stats for the page header. */
export function travelStats(data: TravelData) {
  let restaurants = 0;
  let photos = 0;
  let days = 0;
  const places = new Set<string>();
  for (const trip of data.trips) {
    if (trip.location) places.add(trip.location.trim().toLowerCase());
    for (const day of trip.days) {
      days += 1;
      restaurants += day.restaurants?.length ?? 0;
      photos += day.photos?.length ?? 0;
    }
  }
  return {
    trips: data.trips.length,
    days,
    restaurants,
    photos,
    places: places.size,
  };
}
