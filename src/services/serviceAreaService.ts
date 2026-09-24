import { apiRequest } from "./client";

/**
 * PakwanHus takes orders from one neighbourhood at a time. The server owns that
 * rule and re-checks it on every order; this module exists so the app can warn
 * a customer early instead of letting them fill in a whole checkout and only
 * then be refused.
 *
 * Mirrors meal-host-frontend/src/services/serviceAreaService.ts. See the
 * `meal-host` repo, feature-docs/13-service-area-and-ordering-zone.md.
 */

export interface ServiceArea {
  enforced: boolean;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
}

/** Refusal codes the order endpoints return alongside their message. */
export const OUTSIDE_SERVICE_AREA = "OUTSIDE_SERVICE_AREA";
export const LOCATION_REQUIRED = "LOCATION_REQUIRED";

/**
 * A fix this vague could place an Askari X resident in another part of the
 * city, so it is treated as no fix at all — the same threshold the server
 * applies. Phones indoors on Wi-Fi positioning routinely report worse.
 */
export const MAX_ACCEPTABLE_ACCURACY_M = 1000;

export const serviceAreaService = {
  getServiceArea: async (): Promise<ServiceArea> => {
    return apiRequest<ServiceArea>("service-area");
  },
};

/**
 * Whether a coordinate pair is worth acting on: present, not the 0,0
 * placeholder written by the social sign-in path, in range, and — when an
 * accuracy was reported — precise enough to trust.
 */
export const isUsableCoordinate = (
  latitude?: number | null,
  longitude?: number | null,
  accuracyM?: number | null
): boolean => {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  if (accuracyM != null && accuracyM > MAX_ACCEPTABLE_ACCURACY_M) return false;
  return true;
};

/** Great-circle distance in kilometres between two points. */
export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Whether a point falls inside the zone. Zones that aren't enforced accept everything. */
export const isWithinServiceArea = (
  area: ServiceArea | null,
  latitude: number,
  longitude: number
): boolean => {
  if (!area || !area.enforced) return true;
  return (
    haversineDistanceKm(latitude, longitude, area.center_latitude, area.center_longitude) <=
    area.radius_km
  );
};
