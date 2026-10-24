import { GOOGLE_MAPS_API_KEY } from "@/constants/config";

/**
 * Google Places (New) and Geocoding over plain HTTP — the same services the
 * web app's address search uses, so both clients produce the same address
 * strings (the address-masking logic parses them).
 *
 * Keystrokes within one search share a session token, so Google bills the
 * whole search once when a suggestion is chosen rather than per keystroke.
 */

/** Askari X, Lahore — where suggestions lean and the map opens, as on the web. */
const BIAS_CENTER = { latitude: 31.5353759, longitude: 74.4171308 };
export const DEFAULT_MAP_CENTER = { latitude: BIAS_CENTER.latitude, longitude: BIAS_CENTER.longitude };
const BIAS_RADIUS_M = 30000;

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
}

export interface PickedPlace {
  label: string;
  lat: number;
  lon: number;
}

const stripCountry = (address: string) =>
  address
    .replace(/,\s*Pakistan$/, "")
    // A leading plus code ("GCP8+3PP, Askari X") means nothing to a rider.
    .replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3},\s*/i, "");

/** Random v4-shaped id; Google only needs it unique per search. */
export const newSessionToken = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export const isGooglePlacesEnabled = (): boolean => !!GOOGLE_MAPS_API_KEY;

export async function fetchPlaceSuggestions(
  input: string,
  sessionToken: string
): Promise<PlaceSuggestion[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["pk"],
      languageCode: "en",
      locationBias: { circle: { center: BIAS_CENTER, radius: BIAS_RADIUS_M } },
    }),
  });
  if (!response.ok) throw new Error(`Places autocomplete failed (${response.status})`);
  const data = await response.json();
  return (data.suggestions ?? [])
    .map((s: any) => s.placePrediction)
    .filter(Boolean)
    .map((p: any) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

/** Coordinates and address of a chosen suggestion; closes the billing session. */
export async function fetchPlace(
  placeId: string,
  sessionToken: string
): Promise<PickedPlace | null> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${sessionToken}&languageCode=en`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "location,formattedAddress",
      },
    }
  );
  if (!response.ok) throw new Error(`Place details failed (${response.status})`);
  const place = await response.json();
  if (!place.location) return null;
  return {
    label: stripCountry(place.formattedAddress ?? ""),
    lat: place.location.latitude,
    lon: place.location.longitude,
  };
}

/** What a point on the map turns into. Mirrors the web's ReverseGeocoded. */
export interface ReverseGeocoded {
  /** One-line address for the point. */
  address: string;
  /** Route name, used to pre-fill the Street field. */
  street?: string;
  /** House number known for the point, rarely set in Pakistan. */
  houseNumber?: string;
}

/** Google's address for a point, or null. Never throws. */
async function googleReverseGeocode(lat: number, lon: number): Promise<ReverseGeocoded | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=en&key=${GOOGLE_MAPS_API_KEY}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const results: any[] = data.results ?? [];
    // Plus codes ("8J4H+2X Lahore") are accurate but meaningless to a rider.
    const best = results.find((r) => !r.types?.includes("plus_code")) ?? results[0];
    if (!best?.formatted_address) return null;
    const part = (type: string): string | undefined =>
      (best.address_components ?? []).find((c: any) => c.types?.includes(type))?.long_name;
    return {
      address: stripCountry(best.formatted_address),
      street: part("route"),
      houseNumber: part("street_number"),
    };
  } catch {
    return null;
  }
}

/**
 * Fallback when Google can't name a point (no key, quota, network): the free
 * OpenStreetMap lookup (Photon). Rougher in Pakistan, but better than raw
 * coordinates.
 */
export async function photonReverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocoded | null> {
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&lang=en`);
    if (!response.ok) return null;
    const data = await response.json();
    const p = data?.features?.[0]?.properties;
    if (!p) return null;
    const parts = [
      p.name,
      p.housenumber ? `${p.housenumber} ${p.street ?? ""}`.trim() : p.street,
      p.district,
      p.city || p.town || p.village,
    ];
    const address = Array.from(new Set(parts.filter(Boolean))).join(", ");
    if (!address) return null;
    return { address, street: p.street, houseNumber: p.housenumber };
  } catch {
    return null;
  }
}

/** Google first, then OpenStreetMap. Null only if both fail. Never throws. */
export async function nameForPoint(lat: number, lon: number): Promise<ReverseGeocoded | null> {
  return (await googleReverseGeocode(lat, lon)) ?? (await photonReverseGeocode(lat, lon));
}

/** Short pill title from a one-line address: its first two parts. */
export const shortTitle = (address: string): string =>
  address.split(",").slice(0, 2).join(",").trim();

/** True for a title that is just "33.65375, 73.06342" — an unnamed pin. */
export const looksLikeCoordinates = (text?: string | null): boolean =>
  !!text && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(text);

/** A bare-coordinates title for a pin nothing could name; named later. */
export const coordinatesTitle = (lat: number, lon: number): string =>
  `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
