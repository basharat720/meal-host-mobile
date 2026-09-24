import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

// Photon (Komoot), an OpenStreetMap geocoder. See https://github.com/komoot/photon.
// The same service the web app uses, so both clients produce address strings in
// the same shape — which matters, because the address-masking logic parses them.
interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
    type: string;
  };
  type: string;
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
  type: string;
}

export interface LocationResult {
  label: string;
  lat: number;
  lon: number;
}

// lon_min,lat_min,lon_max,lat_max
const PAKISTAN_BBOX = "60.8725,23.6345,77.8375,37.0841";
const LAHORE_BBOX = "74.0000,31.2000,74.7000,31.7500";

/** A readable one-line address, most specific part first. */
const formatAddress = (feature: PhotonFeature): string => {
  const p = feature.properties;
  const parts = [
    p.name,
    // Avoid repeating the street when the name already is the street.
    p.housenumber ? `${p.housenumber} ${p.street ?? ""}` : p.name ? p.street : undefined,
    p.city || p.town || p.village,
    p.state,
    p.country,
  ];
  return Array.from(new Set(parts.filter(Boolean))).join(", ");
};

/** The bold first line of a suggestion. */
const formatDisplayName = (feature: PhotonFeature): string => {
  const p = feature.properties;
  return (
    p.name ||
    (p.housenumber ? `${p.housenumber} ${p.street ?? ""}` : p.street) ||
    "Unknown Location"
  );
};

interface LocationAutocompleteProps {
  onLocationSelect: (location: LocationResult) => void;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  showUseMyLocation?: boolean;
  /** Bias suggestions towards Lahore instead of all of Pakistan. */
  focusOnLahore?: boolean;
  /** Message shown under the field; also puts it in an error state. */
  error?: string;
  containerStyle?: ViewStyle;
  /**
   * Typing an address is disabled for now — "Locate me" is the only way to set
   * the field. Flip this to true (here or per call site) to bring search back.
   */
  allowManualEntry?: boolean;
}

/**
 * Address field with Photon-backed suggestions and a "Locate me" action.
 *
 * Selecting a suggestion (or locating) hands back both the label and the
 * coordinates, so callers never have to geocode a typed string themselves.
 */
export function LocationAutocomplete({
  onLocationSelect,
  label,
  placeholder,
  defaultValue = "",
  required = false,
  showUseMyLocation = true,
  focusOnLahore = false,
  error,
  containerStyle,
  allowManualEntry = false,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // A programmatic change (a selection, or the parent resetting defaultValue)
  // must not trigger a fresh search for the text we just put in the field.
  const skipNextSearch = useRef(false);

  const resolvedPlaceholder =
    placeholder ??
    (allowManualEntry
      ? "Search for an address..."
      : "Tap \u201cLocate me\u201d to set your location");

  useEffect(() => {
    skipNextSearch.current = true;
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (!allowManualEntry) return;
    if (!query || query.trim().length <= 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    // 500ms, to be polite to a free public API.
    const timer = setTimeout(() => fetchSuggestions(query.trim()), 500);
    return () => clearTimeout(timer);
  }, [query, allowManualEntry]);

  const fetchSuggestions = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const bbox = focusOnLahore ? LAHORE_BBOX : PAKISTAN_BBOX;
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=5&bbox=${bbox}`
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const data: PhotonResponse = await response.json();
      setSuggestions(data.features ?? []);
      setIsOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`
      );
      if (!response.ok) throw new Error("Reverse geocoding failed");
      const data: PhotonResponse = await response.json();
      if (data.features?.length) return formatAddress(data.features[0]);
    } catch {
      // Fall through to the coordinate label.
    }
    return `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  const handleUseMyLocation = async () => {
    setIsGettingLocation(true);
    try {
      // Prompting is right here: the user tapped a button asking for exactly
      // this. Elsewhere the app only reads an already-granted permission.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Location permission is required to set your address. Please enable it in Settings and try again."
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = position.coords;
      const address = await reverseGeocode(latitude, longitude);
      skipNextSearch.current = true;
      setQuery(address);
      setSuggestions([]);
      setIsOpen(false);
      onLocationSelect({ label: address, lat: latitude, lon: longitude });
    } catch {
      Alert.alert(
        "Location Error",
        "Could not get your current location. Please try again."
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSelect = (feature: PhotonFeature) => {
    const label = formatAddress(feature);
    skipNextSearch.current = true;
    setQuery(label);
    setSuggestions([]);
    setIsOpen(false);
    // Photon returns [lon, lat].
    onLocationSelect({
      label,
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0],
    });
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {!!label && (
        <Text style={[styles.label, !!error && styles.labelError]}>
          {label}
          {required ? " *" : ""}
        </Text>
      )}

      <View style={[styles.field, !!error && styles.fieldError]}>
        {/* A non-editable TextInput does not take touches, so the press
            handler lives on a wrapper: with typing off, the field is just a
            second, bigger target for the only action available. */}
        <Pressable
          style={styles.inputWrapper}
          onPress={
            !allowManualEntry && showUseMyLocation && !isGettingLocation
              ? handleUseMyLocation
              : undefined
          }
          disabled={allowManualEntry}
        >
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={resolvedPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            editable={allowManualEntry && !isGettingLocation}
            autoCorrect={false}
            onFocus={() => {
              if (allowManualEntry && suggestions.length > 0) setIsOpen(true);
            }}
          />
        </Pressable>

        {isLoading && <ActivityIndicator size="small" color={colors.mutedForeground} />}

        {showUseMyLocation && (
          <Pressable
            style={styles.locateButton}
            onPress={handleUseMyLocation}
            disabled={isGettingLocation || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate" size={16} color={colors.primary} />
            )}
            <Text style={styles.locateText}>
              {isGettingLocation ? "Locating…" : "Locate me"}
            </Text>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* Rendered inline rather than as an overlay: this field lives inside a
          ScrollView on every screen that uses it, and an absolutely positioned
          list would be clipped and unscrollable. */}
      {allowManualEntry && isOpen && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((feature, index) => (
            <Pressable
              key={`${feature.properties.osm_id ?? "photon"}-${index}`}
              style={({ pressed }) => [
                styles.suggestion,
                index === suggestions.length - 1 && styles.suggestionLast,
                pressed && styles.suggestionPressed,
              ]}
              onPress={() => handleSelect(feature)}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.mutedForeground}
                style={styles.suggestionIcon}
              />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {formatDisplayName(feature)}
                </Text>
                <Text style={styles.suggestionAddress} numberOfLines={2}>
                  {formatAddress(feature)}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text style={styles.attribution}>
            Search by Photon • Data © OpenStreetMap contributors
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  labelError: { color: colors.destructive },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldError: { borderColor: colors.destructive },
  inputWrapper: { flex: 1, minWidth: 0 },
  input: {
    minWidth: 0,
    paddingVertical: 11,
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
  },
  locateButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  locateText: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
  error: { ...typography.xs, color: colors.destructive },

  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionLast: { borderBottomWidth: 0 },
  suggestionPressed: { backgroundColor: colors.muted },
  suggestionIcon: { marginTop: 2 },
  suggestionText: { flex: 1, gap: 2 },
  suggestionName: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  suggestionAddress: { ...typography.xs, color: colors.mutedForeground },
  attribution: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 4,
    backgroundColor: colors.muted,
  },
});
