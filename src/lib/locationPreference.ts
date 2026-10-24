import AsyncStorage from "@react-native-async-storage/async-storage";

// How far from the delivery location Home and Find Chefs search. *Where* they
// search from is no longer stored here: it is the one delivery location chosen
// with the location pill (src/contexts/DeliveryLocationContext.tsx). See
// feature-docs/12-delivery-address-in-the-app.md.
export interface LocationPreference {
  // Search radius in km. Mirrors the website's slider: a radius is always in
  // force, so there is no "any distance".
  radiusKm: number;
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

export const DEFAULT_LOCATION_PREFERENCE: LocationPreference = {
  radiusKm: 50,
};

// Same key as before, so a radius chosen in an older build carries over. The
// old "mode" and "manual" fields it may still hold are ignored.
const STORAGE_KEY = "@meal_host/location_preference";

export async function loadLocationPreference(): Promise<LocationPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCATION_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<LocationPreference>;
    // A radius stored by an older build may be null ("any distance") or sit
    // outside the slider's range; fall back to the default in the first case
    // and clamp in the second.
    const radiusKm =
      typeof parsed.radiusKm === "number" && Number.isFinite(parsed.radiusKm)
        ? clampRadiusKm(parsed.radiusKm)
        : DEFAULT_LOCATION_PREFERENCE.radiusKm;
    return { radiusKm };
  } catch {
    return DEFAULT_LOCATION_PREFERENCE;
  }
}

export async function saveLocationPreference(pref: LocationPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ radiusKm: pref.radiusKm }));
  } catch {
    // Non-fatal: the preference just won't survive a restart.
  }
}
