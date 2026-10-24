import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import {
  PlaceSuggestion,
  fetchPlace,
  fetchPlaceSuggestions,
  isGooglePlacesEnabled,
  newSessionToken,
} from "@/lib/googlePlaces";

/**
 * Address search backed by Google Places (New), limited to Pakistan and leaning
 * towards Lahore. Mirrors meal-host-frontend/src/components/location/
 * PlaceSearchInput.tsx.
 *
 * Keystrokes within one search share a session token, so Google bills the
 * whole search once when a suggestion is chosen rather than per keystroke.
 * Without a Google key the field is read-only and the trailing action (Locate
 * me) is the way in.
 */

export interface PickedPlace {
  lat: number;
  lon: number;
  /** One-line address of the chosen suggestion. */
  label: string;
}

interface PlaceSearchInputProps {
  onPick: (place: PickedPlace) => void;
  label?: string;
  placeholder?: string;
  initialQuery?: string;
  /** Rendered at the right end of the field, e.g. "Locate me". */
  trailing?: ReactNode;
  autoFocus?: boolean;
  /** Puts the field in an error state. */
  error?: boolean;
  containerStyle?: ViewStyle;
}

export function PlaceSearchInput({
  onPick,
  label,
  placeholder = "Enter your address",
  initialQuery = "",
  trailing,
  autoFocus,
  error = false,
  containerStyle,
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sessionToken = useRef<string | null>(null);
  // Only text the customer typed is searched — not the initial text, nor a
  // suggestion we just put in the field.
  const typedRef = useRef(false);
  const searchEnabled = isGooglePlacesEnabled();

  useEffect(() => {
    if (!searchEnabled || !typedRef.current) return;
    const text = query.trim();
    if (text.length <= 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    let cancelled = false;
    // Wait for a pause in typing; Google bills per request.
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        sessionToken.current ??= newSessionToken();
        const found = await fetchPlaceSuggestions(text, sessionToken.current);
        if (cancelled) return;
        setSuggestions(found);
        setIsOpen(true);
      } catch (e) {
        console.warn("Address suggestions failed", e);
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchEnabled]);

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setIsOpen(false);
    setIsLoading(true);
    try {
      // Fetching the place closes the billing session; the next search starts
      // a new one.
      const place = await fetchPlace(
        suggestion.placeId,
        sessionToken.current ?? newSessionToken()
      );
      sessionToken.current = null;
      if (!place) throw new Error("No location for that place");
      const text =
        place.label || [suggestion.main, suggestion.secondary].filter(Boolean).join(", ");
      typedRef.current = false;
      setQuery(text);
      setSuggestions([]);
      onPick({ label: text, lat: place.lat, lon: place.lon });
    } catch (e) {
      console.warn("Could not load that address", e);
      Alert.alert("Address Error", "Could not load that address. Please try another one.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {!!label && <Text style={[styles.label, error && styles.labelError]}>{label}</Text>}

      <View style={[styles.field, error && styles.fieldError]}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(text) => {
            typedRef.current = true;
            setQuery(text);
          }}
          placeholder={searchEnabled ? placeholder : "Address search is unavailable"}
          placeholderTextColor={colors.mutedForeground}
          editable={searchEnabled}
          autoFocus={autoFocus && searchEnabled}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {isLoading && <ActivityIndicator size="small" color={colors.mutedForeground} />}
        {trailing}
      </View>

      {/* Inline rather than an overlay: every screen that uses this scrolls,
          and an absolutely positioned list would be clipped. */}
      {searchEnabled && isOpen && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              style={({ pressed }) => [
                styles.suggestion,
                index === suggestions.length - 1 && styles.suggestionLast,
                pressed && styles.suggestionPressed,
              ]}
              onPress={() => void handleSelect(suggestion)}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.mutedForeground}
                style={styles.suggestionIcon}
              />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {suggestion.main}
                </Text>
                {!!suggestion.secondary && (
                  <Text style={styles.suggestionAddress} numberOfLines={2}>
                    {suggestion.secondary}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
          <Text style={styles.attribution}>powered by Google</Text>
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
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
  },
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
