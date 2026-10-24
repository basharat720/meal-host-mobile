import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { useDeliveryLocation } from "@/contexts/DeliveryLocationContext";

/**
 * The location pill at the top of Home and Find Chefs: the address in use —
 * its label ("Home") or the first part of the address — or "Set your
 * location". Tapping it opens the location sheet.
 */
export function LocationPill({ style }: { style?: ViewStyle }) {
  const { location, savedAddresses, setPickerOpen, isReady } = useDeliveryLocation();

  const label =
    location?.source === "saved"
      ? savedAddresses.find((a) => a.id === location.addressId)?.label || location.title
      : location?.title;

  return (
    <Pressable
      onPress={() => setPickerOpen(true)}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel="Choose your delivery location"
    >
      <Ionicons name="location" size={18} color={colors.primary} />
      <Text style={styles.text} numberOfLines={1}>
        {label ? label : isReady ? "Set your location" : " "}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  text: {
    flexShrink: 1,
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
});
