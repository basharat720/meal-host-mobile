import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import { useAuth } from "@/contexts/AuthContext";
import {
  addressService,
  addressTitle,
  formatFullAddress,
  SavedAddress,
  SavedAddressInput,
} from "@/services/addressService";
import { isUsableCoordinate } from "@/services/serviceAreaService";
import {
  coordinatesTitle,
  looksLikeCoordinates,
  nameForPoint,
  shortTitle,
} from "@/lib/googlePlaces";
import { AddressMapModal } from "@/components/location/AddressMapModal";
import { LocationPickerSheet } from "@/components/location/LocationPickerSheet";

/**
 * The one place the app keeps "where should we deliver / search from".
 *
 * Chosen from the location pill at the top of Home and Find Chefs: a saved
 * address, "Locate me", or a pin dropped on the map. Every screen that cares —
 * Home, Find Chefs, the cart, checkout — reads it from here, and nothing asks
 * the phone for a position on its own: the permission prompt only ever comes
 * from a tap on Locate me.
 *
 * The choice is remembered on the phone, together with the account it was
 * chosen under. It never changes which address is the account's profile
 * (primary) address. Mirrors meal-host-frontend/src/contexts/
 * DeliveryLocationContext.tsx; see feature-docs/12-delivery-address-in-the-app.md.
 */

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  /** Short text for the pill, e.g. "House 12, Street 7". */
  title: string;
  /** Full one-line address, used as an order's delivery address. */
  address?: string;
  /** Set when this is one of the account's saved addresses. */
  addressId?: number;
  /** Phone-reported precision in metres; only for "Locate me" without a pin. */
  accuracyM?: number;
  deliveryInstructions?: string | null;
  source: "saved" | "pin" | "device";
}

/** Why "Locate me" got no position, so the picker can word itself correctly. */
export type LocateFailure =
  | "denied"
  /** Refused with "don't ask again" — only the Settings app can undo this. */
  | "blocked"
  /** Location services are off, or the phone could not get a fix. */
  | "unavailable"
  | "timeout"
  | "imprecise";

export interface LocateResult {
  ok: boolean;
  /** Set when ok, and also for an imprecise fix so the map can open there. */
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  failure?: LocateFailure;
}

export interface AddressMapRequest {
  /** Where to centre the map. Falls back to the current selection, then Askari X. */
  center?: { latitude: number; longitude: number };
  /** Editing an existing saved address rather than adding one. */
  editing?: SavedAddress;
  /** What the search box should show when the map opens. */
  query?: string;
  /**
   * Form mode (sign-up, Profile): the confirmed pin is handed back here instead
   * of becoming the delivery location or a saved address. No details step.
   */
  onConfirm?: (pin: { latitude: number; longitude: number; address: string }) => void;
  /** Label above the pin, e.g. "Your kitchen is here". */
  pinLabel?: string;
}

interface DeliveryLocationContextValue {
  location: DeliveryLocation | null;
  /** False until the remembered location has been read from the phone. */
  isReady: boolean;
  savedAddresses: SavedAddress[];
  isLoadingAddresses: boolean;
  /** Is the location sheet open. Checkout opens it from its own buttons. */
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  selectAddress: (address: SavedAddress) => void;
  setPinnedLocation: (loc: {
    latitude: number;
    longitude: number;
    title: string;
    address?: string;
  }) => void;
  clearLocation: () => void;
  /** Asks the phone where it is. The only place the permission prompt is raised. */
  locateMe: () => Promise<LocateResult>;
  isLocating: boolean;
  /** Opens the "What's your exact location?" map. */
  openAddressMap: (request?: AddressMapRequest) => void;
  saveAddress: (input: SavedAddressInput, editingId?: number) => Promise<SavedAddress>;
  deleteAddress: (id: number) => Promise<void>;
}

const DeliveryLocationContext = createContext<DeliveryLocationContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "foodpal.deliveryLocation";
/** Where checkout used to remember a position before this context existed. */
const LEGACY_ORDER_LOCATION_KEY = "pakwanhus.orderLocation";
/** Text used for a pin neither Google nor OpenStreetMap could name. */
const UNNAMED_PIN = "Pinned location";
/** How long "Locate me" waits for a fresh fix before using a recent one. */
const LOCATE_TIMEOUT_MS = 15000;
const RECENT_FIX_MAX_AGE_MS = 5 * 60 * 1000;

interface StoredLocation {
  /** The account it was chosen under, or null for a signed-out visitor. */
  ownerId: number | null;
  location: DeliveryLocation;
}

const readStored = async (): Promise<StoredLocation | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredLocation;
      const loc = parsed?.location;
      if (!loc || !isUsableCoordinate(loc.latitude, loc.longitude)) return null;
      return parsed;
    }
    // One-off carry-over of the position checkout remembered before, so an
    // update doesn't make anyone pick their location again.
    const legacy = await AsyncStorage.getItem(LEGACY_ORDER_LOCATION_KEY);
    if (!legacy) return null;
    await AsyncStorage.removeItem(LEGACY_ORDER_LOCATION_KEY);
    const old = JSON.parse(legacy) as { latitude: number; longitude: number; address?: string };
    if (!isUsableCoordinate(old.latitude, old.longitude)) return null;
    return {
      ownerId: null,
      location: {
        latitude: old.latitude,
        longitude: old.longitude,
        title: old.address ? shortTitle(old.address) : coordinatesTitle(old.latitude, old.longitude),
        address: old.address,
        source: "pin",
      },
    };
  } catch {
    // Unreadable or corrupt — start with nothing chosen.
    return null;
  }
};

const writeStored = (value: StoredLocation | null) => {
  const write = value
    ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    : AsyncStorage.removeItem(STORAGE_KEY);
  write.catch(() => {
    // Not being able to remember it is not worth failing over.
  });
};

const fromSaved = (a: SavedAddress): DeliveryLocation => ({
  latitude: a.latitude,
  longitude: a.longitude,
  title: addressTitle(a),
  address: formatFullAddress(a),
  addressId: a.id,
  deliveryInstructions: a.delivery_instructions ?? null,
  source: "saved",
});

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export const DeliveryLocationProvider = ({ children }: { children: ReactNode }) => {
  const { dbUser, loading: authLoading, refreshDbUser } = useAuth();
  const userId = dbUser?.id ?? null;

  const [stored, setStored] = useState<StoredLocation | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoadedFor, setAddressesLoadedFor] = useState<number | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [pickerOpen, setPickerOpenState] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapRequest, setMapRequest] = useState<AddressMapRequest | null>(null);
  const isMountedRef = useRef(true);
  const pickerOpenRef = useRef(false);
  // Set once anything is chosen, so a slow storage read can't overwrite it.
  const committedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void readStored().then((value) => {
      if (!isMountedRef.current) return;
      if (!committedRef.current) setStored(value);
      setIsReady(true);
    });
  }, []);

  const setPickerOpen = useCallback((open: boolean) => {
    pickerOpenRef.current = open;
    setPickerOpenState(open);
  }, []);

  const commit = useCallback((location: DeliveryLocation | null, ownerId: number | null) => {
    committedRef.current = true;
    const next = location ? { ownerId, location } : null;
    setStored(next);
    writeStored(next);
  }, []);

  // A saved address chosen under another account must not follow the next
  // person who signs in on this phone. A plain pin (guest or not) may.
  const location = useMemo<DeliveryLocation | null>(() => {
    if (!stored) return null;
    if (stored.location.source === "saved" && stored.ownerId !== userId) return null;
    return stored.location;
  }, [stored, userId]);

  const loadAddresses = useCallback(async () => {
    if (!userId) return [];
    setIsLoadingAddresses(true);
    try {
      const list = await addressService.list();
      if (isMountedRef.current) {
        setSavedAddresses(Array.isArray(list) ? list : []);
        setAddressesLoadedFor(userId);
      }
      return list;
    } catch (error) {
      console.warn("Could not load saved addresses", error);
      return [];
    } finally {
      if (isMountedRef.current) setIsLoadingAddresses(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setSavedAddresses([]);
      setAddressesLoadedFor(null);
      return;
    }
    void loadAddresses();
  }, [authLoading, userId, loadAddresses]);

  // Keep a selected saved address in step with the list: pick up edits, drop
  // it if it was deleted elsewhere, and with nothing chosen yet default to the
  // profile address — never to a permission prompt.
  useEffect(() => {
    if (!isReady || !userId || addressesLoadedFor !== userId) return;
    if (location?.source === "saved") {
      const match = savedAddresses.find((a) => a.id === location.addressId);
      if (!match) {
        commit(null, userId);
      } else {
        const fresh = fromSaved(match);
        if (JSON.stringify(fresh) !== JSON.stringify(location)) commit(fresh, userId);
      }
      return;
    }
    if (!location && savedAddresses.length > 0) {
      const preferred = savedAddresses.find((a) => a.is_primary) ?? savedAddresses[0];
      if (isUsableCoordinate(preferred.latitude, preferred.longitude)) {
        commit(fromSaved(preferred), userId);
      }
    }
  }, [isReady, userId, addressesLoadedFor, savedAddresses, location, commit]);

  // Pins chosen while the address lookup was failing were stored as bare
  // coordinates. Name them once, quietly, so the pill shows a place.
  useEffect(() => {
    if (!location || location.source === "saved") return;
    if (!looksLikeCoordinates(location.title) && location.title !== UNNAMED_PIN) return;
    let cancelled = false;
    void nameForPoint(location.latitude, location.longitude).then((found) => {
      if (cancelled || !found) return;
      commit(
        { ...location, title: shortTitle(found.address), address: found.address },
        stored?.ownerId ?? null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [location, commit, stored?.ownerId]);

  const selectAddress = useCallback(
    (address: SavedAddress) => commit(fromSaved(address), userId),
    [commit, userId]
  );

  const setPinnedLocation = useCallback(
    (loc: { latitude: number; longitude: number; title: string; address?: string }) =>
      commit({ ...loc, source: "pin" }, userId),
    [commit, userId]
  );

  const clearLocation = useCallback(() => commit(null, userId), [commit, userId]);

  const locateMe = useCallback(async (): Promise<LocateResult> => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) return { ok: false, failure: "blocked" };
        // Prompting is right here: the customer tapped Locate me.
        permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          return { ok: false, failure: permission.canAskAgain ? "denied" : "blocked" };
        }
      }
    } catch {
      return { ok: false, failure: "unavailable" };
    }

    setIsLocating(true);
    try {
      if (!(await Location.hasServicesEnabledAsync())) return { ok: false, failure: "unavailable" };
      // getCurrentPositionAsync has no timeout of its own and can hang indoors;
      // after a while settle for a fix from the last few minutes.
      const position =
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          LOCATE_TIMEOUT_MS
        )) ?? (await Location.getLastKnownPositionAsync({ maxAge: RECENT_FIX_MAX_AGE_MS }));
      if (!position) return { ok: false, failure: "timeout" };
      const { latitude, longitude, accuracy } = position.coords;
      // A fix this vague could put an Askari X resident in another city. The
      // map still opens on it, but the picker says to move the pin.
      if (!isUsableCoordinate(latitude, longitude, accuracy)) {
        return { ok: false, failure: "imprecise", latitude, longitude };
      }
      return { ok: true, latitude, longitude, accuracyM: accuracy ?? undefined };
    } catch {
      return { ok: false, failure: "unavailable" };
    } finally {
      if (isMountedRef.current) setIsLocating(false);
    }
  }, []);

  const openAddressMap = useCallback(
    (request: AddressMapRequest = {}) => {
      const fromSheet = pickerOpenRef.current;
      setPickerOpen(false);
      // iOS can't present one modal while another is still sliding away, so
      // the map waits for the sheet to finish closing.
      if (fromSheet && Platform.OS === "ios") {
        setTimeout(() => {
          if (isMountedRef.current) setMapRequest(request);
        }, 450);
      } else {
        setMapRequest(request);
      }
    },
    [setPickerOpen]
  );

  const saveAddress = useCallback(
    async (input: SavedAddressInput, editingId?: number) => {
      const saved = editingId
        ? await addressService.update(editingId, input)
        : await addressService.create(input);
      await loadAddresses();
      // Profile and chef search read dbUser.locations.
      void refreshDbUser();
      commit(fromSaved(saved), userId);
      return saved;
    },
    [loadAddresses, refreshDbUser, commit, userId]
  );

  const deleteAddress = useCallback(
    async (id: number) => {
      await addressService.remove(id);
      if (location?.addressId === id) commit(null, userId);
      await loadAddresses();
      void refreshDbUser();
    },
    [location, commit, userId, loadAddresses, refreshDbUser]
  );

  const value: DeliveryLocationContextValue = {
    location,
    isReady,
    savedAddresses,
    isLoadingAddresses,
    pickerOpen,
    setPickerOpen,
    selectAddress,
    setPinnedLocation,
    clearLocation,
    locateMe,
    isLocating,
    openAddressMap,
    saveAddress,
    deleteAddress,
  };

  return (
    <DeliveryLocationContext.Provider value={value}>
      {children}
      <LocationPickerSheet />
      <AddressMapModal request={mapRequest} onClose={() => setMapRequest(null)} />
    </DeliveryLocationContext.Provider>
  );
};

export const useDeliveryLocation = () => {
  const ctx = useContext(DeliveryLocationContext);
  if (!ctx) throw new Error("useDeliveryLocation must be used within DeliveryLocationProvider");
  return ctx;
};

export { UNNAMED_PIN };
