import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, typography } from "@/constants/theme";
import { LocateFailure, useDeliveryLocation } from "@/contexts/DeliveryLocationContext";
import { PlaceSearchInput } from "@/components/location/PlaceSearchInput";
import { LocateMeButton, LocateTrouble } from "@/components/location/LocateTrouble";

export interface LocationResult {
  label: string;
  lat: number;
  lon: number;
}

interface LocationAutocompleteProps {
  onLocationSelect: (location: LocationResult) => void;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** The pin already chosen, so the map reopens on it. */
  defaultCoords?: { lat: number; lon: number } | null;
  required?: boolean;
  showUseMyLocation?: boolean;
  /**
   * Kept for call sites; Google search always leans towards Lahore (see
   * src/lib/googlePlaces.ts).
   */
  focusOnLahore?: boolean;
  /** Text above the map's pin, e.g. "Your kitchen is here". */
  pinLabel?: string;
  /** Message shown under the field; also puts it in an error state. */
  error?: string;
  containerStyle?: ViewStyle;
}

/**
 * Address field for sign-up and Profile, working like the location sheet:
 * picking a suggestion, "Locate me" or the map button opens the "What's your
 * exact location?" map, and the pin confirmed there with "Use this location"
 * fills the field. Closing the map without confirming leaves the field as it
 * was. Nothing reaches the delivery location or the saved addresses.
 *
 * Mirrors meal-host-frontend/src/components/ui/LocationAutocomplete.tsx; see
 * feature-docs/12-delivery-address-in-the-app.md.
 */
export function LocationAutocomplete({
  onLocationSelect,
  label,
  placeholder = "Search for an address...",
  defaultValue = "",
  defaultCoords,
  required = false,
  showUseMyLocation = true,
  pinLabel = "Your location is here",
  error,
  containerStyle,
}: LocationAutocompleteProps) {
  const { openAddressMap, locateMe, isLocating } = useDeliveryLocation();
  const [trouble, setTrouble] = useState<LocateFailure | null>(null);
  // The confirmed address shows in the field until the parent's value catches up.
  const [confirmedLabel, setConfirmedLabel] = useState<string | null>(null);
  const [lastDefault, setLastDefault] = useState(defaultValue);
  if (lastDefault !== defaultValue) {
    setLastDefault(defaultValue);
    setConfirmedLabel(null);
  }
  // Remounts the search box, putting back the last confirmed text. Done when
  // the map opens (a suggestion picked but not confirmed must not stick) and
  // after a confirm.
  const [resetKey, setResetKey] = useState(0);

  const openMap = (center?: { latitude: number; longitude: number }, query?: string) => {
    setResetKey((n) => n + 1);
    openAddressMap({
      // With nothing else, the map opens on the delivery location, then Askari X.
      center:
        center ??
        (defaultCoords ? { latitude: defaultCoords.lat, longitude: defaultCoords.lon } : undefined),
      query: query ?? confirmedLabel ?? defaultValue,
      pinLabel,
      onConfirm: ({ latitude, longitude, address }) => {
        setConfirmedLabel(address);
        setResetKey((n) => n + 1);
        onLocationSelect({ label: address, lat: latitude, lon: longitude });
      },
    });
  };

  const handleLocate = async () => {
    setTrouble(null);
    const result = await locateMe();
    if (result.latitude != null && result.longitude != null) {
      // Imprecise fixes open the map too, so the pin can be moved.
      openMap({ latitude: result.latitude, longitude: result.longitude }, "");
    } else {
      setTrouble(result.failure ?? "unavailable");
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <PlaceSearchInput
        key={resetKey}
        label={label ? `${label}${required ? " *" : ""}` : undefined}
        placeholder={placeholder}
        initialQuery={confirmedLabel ?? defaultValue}
        error={!!error}
        onPick={(place) => openMap({ latitude: place.lat, longitude: place.lon }, place.label)}
        trailing={
          <View style={styles.actions}>
            {showUseMyLocation && (
              <LocateMeButton compact onPress={() => void handleLocate()} isLocating={isLocating} />
            )}
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              onPress={() => openMap()}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Choose on the map"
            >
              <Ionicons name="map-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        }
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.helper}>Search, use your location, or pick it on the map</Text>
      )}
      <LocateTrouble failure={trouble} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: -4 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  error: { ...typography.xs, fontFamily: fonts.sans, color: colors.destructive },
  helper: { ...typography.xs, fontFamily: fonts.sans, color: colors.mutedForeground },
});
