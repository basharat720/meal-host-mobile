import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import {
  ServiceArea,
  haversineDistanceKm,
  isUsableCoordinate,
  isWithinServiceArea,
  serviceAreaService,
} from "@/services/serviceAreaService";

/**
 * Works out where the customer is, using the phone's location and falling back
 * to an address they pick by hand.
 *
 * This decides nothing on its own. Ordering is never blocked by location; the
 * position it resolves is what `useDeliveryAvailability` sends to the server to
 * find out whether the delivery option may be offered, and what the order
 * itself carries so the server judges the same point. See the `meal-host` repo,
 * feature-docs/13-service-area-and-ordering-zone.md.
 *
 * Mirrors meal-host-frontend/src/hooks/useServiceAreaGate.ts, with one
 * deliberate difference: **mounting never raises the system permission
 * prompt.** The app only reads a position it already has permission for; the
 * prompt is raised from a button the customer taps. See
 * `feature-docs/07-ordering-zone-in-the-app.md`.
 */

export type GateStatus =
  /** Still fetching the zone, reading storage, or waiting on the phone. */
  | "checking"
  /** Inside the zone — delivery is possible from the customer's end. */
  | "inside"
  /** Located, but too far from the zone centre for delivery. */
  | "outside"
  /** No usable position: permission not granted, unavailable, or too imprecise. */
  | "needs-location";

/** Why we have no position, so the card can word itself correctly. */
export type LocationFailure =
  | "denied"
  /** Refused with "don't ask again" — only the Settings app can undo this. */
  | "blocked"
  | "unavailable"
  | "timeout"
  | "imprecise";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  /** Phone-reported precision in metres; absent for a hand-picked address. */
  accuracyM?: number;
  address?: string;
  source: "device" | "manual";
}

const STORAGE_KEY = "pakwanhus.orderLocation";

const readStoredLocation = async (): Promise<ResolvedLocation | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResolvedLocation;
    return isUsableCoordinate(parsed.latitude, parsed.longitude) ? parsed : null;
  } catch {
    // Unreadable or corrupt — carry on without a remembered location.
    return null;
  }
};

const writeStoredLocation = (location: ResolvedLocation | null) => {
  const write = location
    ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location))
    : AsyncStorage.removeItem(STORAGE_KEY);
  write.catch(() => {
    // Not being able to remember it is not worth failing over.
  });
};

export const useServiceAreaGate = (
  options: {
    enabled?: boolean;
    /**
     * Whether to read the phone's position on mount when permission has
     * already been granted. Screens that only want to report what is already
     * known — the cart, say — pass false, so nothing is read somewhere the
     * customer didn't ask to be located.
     *
     * This never raises the permission prompt either way; only
     * `requestDeviceLocation()` does.
     */
    autoLocate?: boolean;
  } = {}
) => {
  const { enabled = true, autoLocate = true } = options;

  const [area, setArea] = useState<ServiceArea | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [failure, setFailure] = useState<LocationFailure | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isAreaLoading, setIsAreaLoading] = useState(true);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  // Until the quiet read has been attempted, "no location" is not yet an
  // answer — without this the card flashes for a frame on the way in.
  const [autoLocateDone, setAutoLocateDone] = useState(!autoLocate);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // A location confirmed earlier is reused, so moving between the cart and
  // checkout doesn't ask again.
  useEffect(() => {
    let cancelled = false;
    void readStoredLocation().then((stored) => {
      if (cancelled) return;
      if (stored) setLocation(stored);
      setIsStoreLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * Read the phone's position. Resolves either way — never throws.
   *
   * `prompt` decides whether a customer who has not answered the permission
   * question yet is asked it now. Mounting passes false; a button passes true.
   */
  const locate = useCallback(async (prompt: boolean): Promise<boolean> => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted) {
        if (!prompt) {
          // Nothing to report yet — the customer has not been asked, so this
          // is not a failure, just an unanswered question.
          return false;
        }
        if (!permission.canAskAgain) {
          // The system will not show the prompt again; only Settings can undo it.
          setFailure("blocked");
          return false;
        }
        permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setFailure(permission.canAskAgain ? "denied" : "blocked");
          return false;
        }
      }
    } catch {
      if (isMountedRef.current) setFailure("unavailable");
      return false;
    }

    setIsLocating(true);
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        if (isMountedRef.current) setFailure("unavailable");
        return false;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!isMountedRef.current) return false;

      const { latitude, longitude, accuracy } = position.coords;
      if (!isUsableCoordinate(latitude, longitude, accuracy)) {
        setFailure("imprecise");
        return false;
      }

      const resolved: ResolvedLocation = {
        latitude,
        longitude,
        accuracyM: accuracy ?? undefined,
        source: "device",
      };
      setLocation(resolved);
      writeStoredLocation(resolved);
      setFailure(null);
      return true;
    } catch {
      // expo-location throws rather than reporting a timeout separately.
      if (isMountedRef.current) setFailure("timeout");
      return false;
    } finally {
      if (isMountedRef.current) setIsLocating(false);
    }
  }, []);

  /** Ask the phone where we are, raising the permission prompt if needed. */
  const requestDeviceLocation = useCallback(() => locate(true), [locate]);

  /** Use an address the customer picked from the suggestions. */
  const setManualLocation = useCallback(
    (latitude: number, longitude: number, address?: string) => {
      if (!isUsableCoordinate(latitude, longitude)) return;
      const resolved: ResolvedLocation = { latitude, longitude, address, source: "manual" };
      setLocation(resolved);
      writeStoredLocation(resolved);
      setFailure(null);
    },
    []
  );

  const clearLocation = useCallback(() => {
    setLocation(null);
    writeStoredLocation(null);
    setFailure(null);
  }, []);

  /**
   * Send the customer to this app's settings screen to undo a permission they
   * refused for good. The website can only describe where the menu is.
   */
  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  // Use permission already granted, quietly. Never prompts — see the note at
  // the top of the file.
  useEffect(() => {
    if (!enabled || !autoLocate || isStoreLoading || autoLocateDone) return;
    // A remembered location is answer enough; don't read the phone again.
    if (location) {
      setAutoLocateDone(true);
      return;
    }
    void locate(false).finally(() => {
      if (isMountedRef.current) setAutoLocateDone(true);
    });
    // Intentionally not re-run when `location` appears — that's the success case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoLocate, isStoreLoading, autoLocateDone, locate]);

  let status: GateStatus = "checking";
  if (!enabled || (area !== null && !area.enforced)) {
    status = "inside";
  } else if (isAreaLoading || isStoreLoading || isLocating || !autoLocateDone) {
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

  return {
    /** The active zone, or null if it couldn't be loaded. */
    area,
    /** The position being used, if any. */
    location,
    /** Why there is no position, when the customer has been asked and there isn't one. */
    failure,
    status,
    distanceKm,
    isLocating,
    /**
     * True once we know this position can't receive a delivery — either it is
     * outside the zone or we never got one. Nothing is blocked by it: it only
     * means the customer's end of the delivery rule has failed.
     */
    isOutsideDeliveryZone: status === "outside" || status === "needs-location",
    requestDeviceLocation,
    setManualLocation,
    clearLocation,
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
