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
  // Search radius in km. `null` means "any distance" — search everywhere,
  // ignoring location entirely.
  radiusKm: number | null;
  // Only set when mode === "manual".
  manual?: ManualLocation;
}

// Selectable radii shown in the filter sheet. `null` == "Any distance".
export const RADIUS_OPTIONS: { value: number | null; label: string }[] = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
  { value: null, label: "Any distance" },
];

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
    // radiusKm may legitimately be null ("any"); only fall back to the default
    // when it's missing/invalid entirely.
    const radiusKm =
      parsed.radiusKm === null
        ? null
        : typeof parsed.radiusKm === "number"
          ? parsed.radiusKm
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
