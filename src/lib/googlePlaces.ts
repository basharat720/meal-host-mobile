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

/**
 * OpenStreetMap files most of Lahore Cantt (Askari X among them) under a
 * "city" called Derh Pindi, or the misspelt "Lahore Cant". Nobody there uses
 * either, so both read as Lahore Cantt — but only inside Lahore, in case a
 * real Derh Pindi turns up elsewhere. Mirrors the web's googleMaps.ts.
 */
const CITY_ALIASES: Record<string, string> = {
  "Derh Pindi": "Lahore Cantt",
  "Lahore Cant": "Lahore Cantt",
};

const fixCityNames = (address: string): string =>
  /\bLahore\b/i.test(address)
    ? Object.entries(CITY_ALIASES).reduce(
        (text, [wrong, right]) => text.replace(new RegExp(`\\b${wrong}\\b(?!t)`, "g"), right),
        address
      )
    : address;

/** A house this far from the pin is taken as the pin's own house. */
const HOUSE_MATCH_METERS = 30;
/** A street this far from the pin is taken as the pin's street. */
const STREET_MATCH_METERS = 60;
/** Google places a street at its middle, so its match is a little looser. */
const GOOGLE_STREET_MATCH_METERS = 75;

const metersBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const rad = Math.PI / 180;
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
};


/** The bits of a geocoding result this file reads — the same shape whether it
 *  comes from the Maps JavaScript API or the Geocoding web service. */
interface GoogleResultLike {
  types: string[];
  formatted_address: string;
  address_components: { long_name: string; short_name: string; types: string[] }[];
  geometry: { location: { lat: number | (() => number); lng: number | (() => number) } };
}

const coord = (v: number | (() => number)) => (typeof v === "function" ? v() : v);

/** "SECTOR F" → "Sector F"; mixed-case names are left alone. */
const tidyCase = (text: string) =>
  text === text.toUpperCase() ? text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : text;

/**
 * An address for a pin from Google's results, built from parts rather than
 * taken whole: Google's first answer is often a neighbouring plot 60–100 m
 * away, and its full address would send a rider to the wrong door. The house
 * number is only taken from a result practically under the pin, the street
 * from one close by; the sector, area and city come from any of them.
 */
const fromGoogleResults = (
  results: GoogleResultLike[],
  lat: number,
  lng: number
): ReverseGeocoded | null => {
  const named = results.filter((r) => !r.types.includes("plus_code"));
  if (named.length === 0) return null;
  const distanceTo = (r: GoogleResultLike) =>
    metersBetween(lat, lng, coord(r.geometry.location.lat), coord(r.geometry.location.lng));
  const partOf = (r: GoogleResultLike | undefined, type: string, short = false) => {
    const c = r?.address_components.find((x) => x.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : undefined;
  };
  const firstPart = (type: string) =>
    named.map((r) => partOf(r, type)).find(Boolean);

  const houseResult = named.find(
    (r) =>
      distanceTo(r) <= HOUSE_MATCH_METERS &&
      (partOf(r, "street_number") || partOf(r, "premise") || partOf(r, "subpremise"))
  );
  const houseNumber = houseResult
    ? partOf(houseResult, "street_number") ??
      partOf(houseResult, "premise") ??
      partOf(houseResult, "subpremise")
    : undefined;
  const streetResult =
    (houseResult && partOf(houseResult, "route") ? houseResult : undefined) ??
    named.find((r) => partOf(r, "route") && distanceTo(r) <= GOOGLE_STREET_MATCH_METERS);
  const street = partOf(streetResult, "route", true);

  const sector = firstPart("sublocality_level_2") ?? firstPart("neighborhood");
  const area = firstPart("sublocality_level_1");
  // The locality ("Lahore"), not the administrative area: Google files much
  // of Lahore, Gulberg included, under the "Lahore Cantt" tehsil, which reads
  // wrong to anyone outside the cantonment.
  const city = firstPart("locality") ?? firstPart("administrative_area_level_3");

  const parts = [
    houseNumber ? (/^\d/.test(houseNumber) ? `House ${houseNumber}` : houseNumber) : undefined,
    street,
    sector ? tidyCase(sector) : undefined,
    area,
    city,
  ];
  const built = Array.from(new Set(parts.filter(Boolean))).join(", ");
  const address = built || stripCountry(named[0].formatted_address);
  return { address: fixCityNames(address), street, houseNumber };
};

/** Google's address for a point, or null. Never throws. */
async function googleReverseGeocode(lat: number, lon: number): Promise<ReverseGeocoded | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=en&key=${GOOGLE_MAPS_API_KEY}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "OK") return null;
    return fromGoogleResults(data.results ?? [], lat, lon);
  } catch {
    return null;
  }
}

interface PhotonFeature {
  properties: Record<string, string | undefined>;
  geometry?: { coordinates?: [number, number] };
}

/**
 * The free OpenStreetMap lookup (Photon), used when Google can't name a point.
 *
 * Its nearest feature is often a landmark — a park, a bank, a monument — whose
 * name is no use as a delivery address, so the address is built from the
 * street, sector, area and city instead. A house number is only taken from a
 * building practically under the pin.
 */
export async function photonReverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocoded | null> {
  try {
    const response = await fetch(
      `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&lang=en&limit=5`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const features: PhotonFeature[] = data?.features ?? [];
    if (features.length === 0) return null;

    const distanceTo = (f: PhotonFeature) => {
      const c = f.geometry?.coordinates;
      return c ? metersBetween(lat, lon, c[1], c[0]) : Infinity;
    };
    const house = features.find(
      (f) => f.properties.housenumber && distanceTo(f) <= HOUSE_MATCH_METERS
    );
    const first = features[0].properties;
    // The street (and its sector) from the nearest feature that names one:
    // a house or landmark's own street, or a street itself.
    const streetOf = (f: PhotonFeature) =>
      f.properties.street ?? (f.properties.type === "street" ? f.properties.name : undefined);
    const onStreet =
      house ?? features.find((f) => streetOf(f) && distanceTo(f) <= STREET_MATCH_METERS);
    const street = onStreet ? streetOf(onStreet) : undefined;
    const sector = onStreet?.properties.locality ?? first.locality;
    const inLahore = !!first.county?.startsWith("Lahore");
    const rawCity = first.city || first.town || first.village;
    const city = (inLahore && rawCity && CITY_ALIASES[rawCity]) || rawCity;

    const parts = [
      house?.properties.housenumber ? `House ${house.properties.housenumber}` : undefined,
      street,
      sector,
      first.district ?? (first.type === "district" ? first.name : undefined),
      city,
      // A village or suburb name alone doesn't say which city it is in.
      inLahore && !/Lahore/.test(city ?? "") ? "Lahore" : undefined,
    ];
    const address = Array.from(new Set(parts.filter(Boolean))).join(", ");
    if (!address) return null;
    return { address, street, houseNumber: house?.properties.housenumber };
  } catch {
    return null;
  }
}

/**
 * Google first, then OpenStreetMap. Null only if both fail. Never throws. When
 * Google names the place but has no house number — the usual case in Pakistan
 * — a house OpenStreetMap knows right under the pin fills it in, so there is
 * less to type.
 */
export async function nameForPoint(lat: number, lon: number): Promise<ReverseGeocoded | null> {
  const google = await googleReverseGeocode(lat, lon);
  if (!google) return photonReverseGeocode(lat, lon);
  if (google.houseNumber && google.street) return google;
  const osm = await photonReverseGeocode(lat, lon);
  return {
    ...google,
    houseNumber: google.houseNumber ?? osm?.houseNumber,
    street: google.street ?? osm?.street,
  };
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
