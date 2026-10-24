import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";

import {
  ServiceArea,
  haversineDistanceKm,
  isUsableCoordinate,
  isWithinServiceArea,
  serviceAreaService,
} from "@/services/serviceAreaService";
import { useDeliveryLocation } from "@/contexts/DeliveryLocationContext";

/**
 * Reports whether the customer's end of the ordering-zone rule passes.
 *
 * The position is the one chosen with the location pill (a saved address, or a
 * pin dropped on the map) — this hook no longer asks the phone for one itself,
 * and so never raises the permission prompt. It decides nothing on its own:
 * ordering is never blocked by location. The position is what
 * `useDeliveryAvailability` sends to the server to find out whether delivery
 * may be offered, and what the order itself carries so the server checks the
 * same point. See the `meal-host` repo,
 * feature-docs/13-service-area-and-ordering-zone.md, and this repo's
 * feature-docs/07-ordering-zone-in-the-app.md.
 *
 * Mirrors meal-host-frontend/src/hooks/useServiceAreaGate.ts.
 */

export type GateStatus =
  /** Still fetching the zone, or reading the remembered location. */
  | "checking"
  /** Inside the zone — delivery is possible from the customer's end. */
  | "inside"
  /** Located, but too far from the zone centre for delivery. */
  | "outside"
  /** No location chosen yet. */
  | "needs-location";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  /** Phone-reported precision in metres; absent for a pinned or saved address. */
  accuracyM?: number;
  address?: string;
}

export const useServiceAreaGate = (options: { enabled?: boolean } = {}) => {
  const { enabled = true } = options;
  const { location: chosen, isReady, setPickerOpen } = useDeliveryLocation();

  const [area, setArea] = useState<ServiceArea | null>(null);
  const [isAreaLoading, setIsAreaLoading] = useState(true);

  // Load the active zone. If this fails we deliberately fall open: the server
  // still enforces the rule, and a flaky config fetch shouldn't cost anyone
  // the delivery option.
  useEffect(() => {
    if (!enabled) {
      setIsAreaLoading(false);
      return;
    }
    let cancelled = false;
    serviceAreaService
      .getServiceArea()
      .then((result) => {
        if (!cancelled) setArea(result);
      })
      .catch(() => {
        if (!cancelled) setArea(null);
      })
      .finally(() => {
        if (!cancelled) setIsAreaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const location: ResolvedLocation | null =
    chosen && isUsableCoordinate(chosen.latitude, chosen.longitude, chosen.accuracyM)
      ? {
          latitude: chosen.latitude,
          longitude: chosen.longitude,
          accuracyM: chosen.accuracyM,
          address: chosen.address,
        }
      : null;

  let status: GateStatus = "checking";
  if (!enabled || (area !== null && !area.enforced)) {
    status = "inside";
  } else if (isAreaLoading || !isReady) {
    status = "checking";
  } else if (location) {
    status = isWithinServiceArea(area, location.latitude, location.longitude)
      ? "inside"
      : "outside";
  } else {
    status = "needs-location";
  }

  const distanceKm =
    area && location
      ? haversineDistanceKm(
          location.latitude,
          location.longitude,
          area.center_latitude,
          area.center_longitude
        )
      : null;

  /** Opens the location sheet, e.g. from checkout's "Change". */
  const openLocationPicker = useCallback(() => setPickerOpen(true), [setPickerOpen]);

  /**
   * Send the customer to this app's settings screen to undo a permission they
   * refused for good. The website can only describe where the menu is.
   */
  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return {
    /** The active zone, or null if it couldn't be loaded. */
    area,
    /** The position being used, if any. */
    location,
    status,
    distanceKm,
    /**
     * True once we know this position can't receive a delivery — either it is
     * outside the zone or none was chosen. Nothing is blocked by it: it only
     * means the customer's end of the delivery rule has failed.
     */
    isOutsideDeliveryZone: status === "outside" || status === "needs-location",
    openLocationPicker,
    openSettings,
    /** The fields to send with an order, so the server checks the same position. */
    orderLocationPayload: location
      ? {
          customer_latitude: location.latitude,
          customer_longitude: location.longitude,
          ...(location.accuracyM != null
            ? { customer_location_accuracy_m: location.accuracyM }
            : {}),
        }
      : {},
  };
};
