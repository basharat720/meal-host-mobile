import AsyncStorage from "@react-native-async-storage/async-storage";

// Where the Home dish feed should search from:
//  - "gps":     the device's current GPS position (default, legacy behaviour)
//  - "profile": the address saved on the user's profile
//  - "manual":  a location the user typed in and we geocoded
export type LocationMode = "gps" | "profile" | "manual";

export interface ManualLocation {
  lat: number;
  lon: number;
  label: string;
}

export interface LocationPreference {
  mode: LocationMode;
  // Search radius in km. Mirrors the website's slider: a radius is always in
  // force, so there is no "any distance".
  radiusKm: number;
  // Only set when mode === "manual".
  manual?: ManualLocation;
}

// Bounds of the distance slider shown in the filter sheet. Any radius in this
// range is selectable, not just a handful of preset steps.
export const RADIUS_MIN_KM = 1;
export const RADIUS_MAX_KM = 50;
export const RADIUS_STEP_KM = 1;

// Pull a radius back into the slider's range, rounded to a whole step.
export function clampRadiusKm(value: number): number {
  const stepped = Math.round(value / RADIUS_STEP_KM) * RADIUS_STEP_KM;
  return Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, stepped));
}

// Preserves the app's original behaviour: live GPS within 50 km.
export const DEFAULT_LOCATION_PREFERENCE: LocationPreference = {
  mode: "gps",
  radiusKm: 50,
};

const STORAGE_KEY = "@meal_host/location_preference";

export async function loadLocationPreference(): Promise<LocationPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCATION_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<LocationPreference>;
    const mode: LocationMode =
      parsed.mode === "profile" || parsed.mode === "manual" ? parsed.mode : "gps";
    // A radius stored by an older build may be null ("any distance") or sit
    // outside the slider's range; fall back to the default in the first case
    // and clamp in the second.
    const radiusKm =
      typeof parsed.radiusKm === "number" && Number.isFinite(parsed.radiusKm)
        ? clampRadiusKm(parsed.radiusKm)
        : DEFAULT_LOCATION_PREFERENCE.radiusKm;
    const manual =
      parsed.manual &&
      typeof parsed.manual.lat === "number" &&
      typeof parsed.manual.lon === "number"
        ? {
            lat: parsed.manual.lat,
            lon: parsed.manual.lon,
            label: parsed.manual.label ?? "",
          }
        : undefined;
    return { mode, radiusKm, manual };
  } catch {
    return DEFAULT_LOCATION_PREFERENCE;
  }
}

export async function saveLocationPreference(pref: LocationPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Non-fatal: the preference just won't survive a restart.
  }
}
