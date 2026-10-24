import React from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import type { LocateFailure } from "@/contexts/DeliveryLocationContext";

/**
 * The note shown under the search box when "Locate me" found nothing. A
 * permission refused for good gets a button straight to FoodPal's page in the
 * phone's Settings — the website can only describe where that is.
 */
export function LocateTrouble({ failure }: { failure: LocateFailure | null }) {
  if (!failure || failure === "imprecise") return null;

  const message =
    failure === "blocked"
      ? "Location access is turned off for FoodPal. Turn it on in Settings, or search for your address instead."
      : failure === "unavailable"
        ? "Location services are off on this phone. Turn them on, or search for your address instead."
        : "We're having trouble finding you. Check your connection and location access.";

  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {failure === "blocked" && (
        <Pressable
          onPress={() => void Linking.openSettings()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Open Settings</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The "Locate me" action that sits at the end of a search field. */
export function LocateMeButton({
  onPress,
  isLocating,
  disabled,
}: {
  onPress: () => void;
  isLocating: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={styles.locate}
      onPress={onPress}
      disabled={isLocating || disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Use my current location"
    >
      {isLocating ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="locate" size={16} color={colors.primary} />
      )}
      <Text style={styles.locateText}>{isLocating ? "Locating…" : "Locate me"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  locate: { flexDirection: "row", alignItems: "center", gap: 4 },
  locateText: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  text: { ...typography.sm, color: colors.foreground },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.8 },
  buttonText: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
  },
});
