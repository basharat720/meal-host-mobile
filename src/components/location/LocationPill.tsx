import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { useDeliveryLocation } from "@/contexts/DeliveryLocationContext";

/**
 * The "Deliver to" row in the header of Home and Find Chefs: the address in
 * use — its label ("Home") or the first part of the address — or "Set your
 * location". Tapping it opens the location sheet.
 *
 * `variant="header"` is the two-line form for the tinted header beside the
 * logo: the street in bold, the area under it (Foodpanda style).
 */
export function LocationPill({
  style,
  variant = "row",
}: {
  style?: ViewStyle;
  variant?: "row" | "header";
}) {
  const { location, savedAddresses, setPickerOpen, isReady } = useDeliveryLocation();

  const saved =
    location?.source === "saved"
      ? savedAddresses.find((a) => a.id === location.addressId)
      : undefined;
  const title = saved?.label || location?.title;
  // Under a label ("Home"), show which address it is.
  const detail = saved?.label && location?.title !== saved.label ? location?.title : undefined;

  if (variant === "header") {
    // A label ("Home") over its address; otherwise the street over the area.
    const [line1, line2] = saved?.label
      ? [saved.label, detail ?? ""]
      : splitAddress(location?.title, location?.address);
    return (
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed, style]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={title ? `Delivering to ${title}. Change location` : "Set your location"}
      >
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {line1 ? line1 : isReady ? "Set your location" : " "}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.foreground} />
        </View>
        <Text style={styles.headerArea} numberOfLines={1}>
          {line1 ? line2 || "Deliver here" : "Tap to choose where to deliver"}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => setPickerOpen(true)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={title ? `Delivering to ${title}. Change location` : "Set your location"}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="location" size={18} color={colors.primary} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.caption}>Deliver to</Text>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, !title && isReady && styles.titleEmpty]}
            numberOfLines={1}
          >
            {title ? title : isReady ? "Set your location" : " "}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={title ? colors.foreground : colors.primary}
          />
        </View>
        {!!detail && (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, minWidth: 0 },
  caption: {
    ...typography.xs,
    fontFamily: fonts.sans,
    color: colors.mutedForeground,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: {
    flexShrink: 1,
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  titleEmpty: { color: colors.primary },
  header: { flexShrink: 1, minWidth: 0 },
  headerTitle: {
    flexShrink: 1,
    ...typography.md,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  headerArea: {
    ...typography.sm,
    fontFamily: fonts.sans,
    color: colors.mutedForeground,
  },
  detail: {
    ...typography.xs,
    fontFamily: fonts.sans,
    color: colors.mutedForeground,
  },
});

/**
 * Splits an address into the street and the area under it: "Street 40C,
 * F-7, Islamabad, Islamabad" → ["Street 40C", "F-7, Islamabad"]. Repeated
 * parts collapse and bare postcodes are dropped.
 */
function splitAddress(title?: string, address?: string): [string, string] {
  const parts: string[] = [];
  for (const raw of `${title ?? ""},${address ?? ""}`.split(",")) {
    const part = raw.trim();
    if (!part || /^\d+$/.test(part)) continue;
    if (!parts.some((p) => p.toLowerCase() === part.toLowerCase())) parts.push(part);
  }
  return [parts[0] ?? "", parts.slice(1, 3).join(", ")];
}
