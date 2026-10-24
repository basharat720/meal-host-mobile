import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
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
      <View style={styles.row}>
        <PlaceSearchInput
          key={resetKey}
          label={label ? `${label}${required ? " *" : ""}` : undefined}
          placeholder={placeholder}
          initialQuery={confirmedLabel ?? defaultValue}
          error={!!error}
          containerStyle={styles.flex}
          onPick={(place) => openMap({ latitude: place.lat, longitude: place.lon }, place.label)}
          trailing={
            showUseMyLocation ? (
              <LocateMeButton onPress={() => void handleLocate()} isLocating={isLocating} />
            ) : undefined
          }
        />
        <Pressable
          style={({ pressed }) => [styles.mapButton, !!label && styles.mapButtonLabelled, pressed && styles.pressed]}
          onPress={() => openMap()}
          accessibilityRole="button"
          accessibilityLabel="Choose on the map"
        >
          <Ionicons name="map-outline" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      <LocateTrouble failure={trouble} />
    </View>
  );
}

// Height of the label line above the field, so the map button lines up with
// the field rather than the label.
const LABEL_OFFSET = (typography.sm.lineHeight ?? 18) + 6;

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1 },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonLabelled: { marginTop: LABEL_OFFSET },
  pressed: { opacity: 0.8 },
  error: { ...typography.xs, fontFamily: fonts.sans, color: colors.destructive },
});
