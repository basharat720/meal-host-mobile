import { useEffect, useRef, useState } from "react";

import {
  DeliveryAvailability,
  DeliveryUnavailableReason,
  serviceAreaService,
} from "@/services/serviceAreaService";

/**
 * Whether the delivery option may be offered for a basket.
 *
 * PakwanHus delivers only when both ends of the trip are inside the Askari X
 * zone, and the kitchen's exact pickup coordinates are deliberately never
 * published — checkout only ever shows a masked address until an order is
 * placed. So this can't be worked out on the device: the server answers,
 * running the same check the order endpoint will.
 *
 * Pickup is always available, so a failure here never blocks anything — it only
 * decides whether the Delivery option is tappable. Mirrors
 * meal-host-frontend/src/hooks/useDeliveryAvailability.ts. See the `meal-host`
 * repo, feature-docs/13-service-area-and-ordering-zone.md.
 */

export interface DeliveryAvailabilityState {
  /** Null while the answer is still unknown. */
  deliveryAvailable: boolean | null;
  reason: DeliveryUnavailableReason | null;
  /** The server's customer-facing explanation, when delivery isn't available. */
  message: string | null;
  isChecking: boolean;
}

export const useDeliveryAvailability = (options: {
  enabled?: boolean;
  listingIds: number[];
  chefId?: number;
  /** The customer's position, from `useServiceAreaGate`. */
  locationPayload: {
    customer_latitude?: number;
    customer_longitude?: number;
    customer_location_accuracy_m?: number;
  };
}): DeliveryAvailabilityState => {
  const { enabled = true, listingIds, chefId, locationPayload } = options;

  const [state, setState] = useState<DeliveryAvailabilityState>({
    deliveryAvailable: null,
    reason: null,
    message: null,
    isChecking: enabled,
  });

  // A fresh array literal every render would restart the request forever, so
  // the inputs are compared by value rather than by identity.
  const key = JSON.stringify({
    listingIds: [...listingIds].sort(),
    chefId,
    locationPayload,
  });
  const latestKey = useRef(key);
  latestKey.current = key;

  useEffect(() => {
    if (!enabled) {
      setState({
        deliveryAvailable: null,
        reason: null,
        message: null,
        isChecking: false,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isChecking: true }));

    serviceAreaService
      .checkDeliveryAvailability({
        chef_id: chefId,
        listing_ids: listingIds,
        ...locationPayload,
      })
      .then((result: DeliveryAvailability) => {
        if (cancelled) return;
        setState({
          deliveryAvailable: result.delivery_available,
          reason: result.reason,
          message: result.message,
          isChecking: false,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        // Fall closed. The server refuses an ineligible delivery order anyway,
        // so offering the option on a failed check would only move the refusal
        // to the end of checkout — exactly what this hook exists to avoid.
        console.warn("Could not check delivery availability", error);
        setState({
          deliveryAvailable: false,
          reason: null,
          message: null,
          isChecking: false,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return state;
};
