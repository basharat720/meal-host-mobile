import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  LocationAutocomplete,
  type LocationResult,
} from "@/components/ui/LocationAutocomplete";
import type { GateStatus, LocationFailure } from "@/hooks/useServiceAreaGate";
import { colors, radius, spacing, typography } from "@/constants/theme";

/**
 * Asks the customer where they are, when the phone wouldn't say or said
 * somewhere we don't deliver yet.
 *
 * The website shows this as a dialog raised over checkout. The app shows it in
 * the checkout form instead, because it never raises the system permission
 * prompt on its own — the prompt only follows a tap on the button here. See
 * `feature-docs/07-ordering-zone-in-the-app.md`.
 */

interface LocationRequiredCardProps {
  status: GateStatus;
  failure: LocationFailure | null;
  isLocating: boolean;
  /** Name of the area currently being served, e.g. "Askari X". */
  areaName?: string;
  /** Resolves true when a usable position was obtained. */
  onRetryDeviceLocation: () => Promise<boolean>;
  onManualLocation: (latitude: number, longitude: number, address?: string) => void;
  onOpenSettings: () => void;
}

export function LocationRequiredCard({
  status,
  failure,
  isLocating,
  areaName,
  onRetryDeviceLocation,
  onManualLocation,
  onOpenSettings,
}: LocationRequiredCardProps) {
  const isOutside = status === "outside";

  // Each failure gets a line that describes what actually happened, so the
  // customer isn't told to check a permission that was never the problem.
  const message = isOutside
    ? `We're not delivering to your area yet.${
        areaName ? ` PakwanHus is currently available in ${areaName} only.` : ""
      } Enter a different address to check another location.`
    : failure === "blocked"
      ? "Location is turned off for PakwanHus. Turn it on in Settings, or enter your address below."
      : failure === "denied"
        ? "We can't check your area without your location. Try again, or enter your address below."
        : failure === "imprecise"
          ? "We could only find you approximately. Enter your address so we can check it exactly."
          : failure === "unavailable"
            ? "Location services are off on this phone. Turn them on, or enter your address below."
            : failure === "timeout"
              ? "We're having trouble finding you. Check your connection and try again."
              : `We deliver in ${areaName ?? "one area"} only for now, so we need to know where you are before you order.`;

  const handleSelect = (result: LocationResult) => {
    onManualLocation(result.lat, result.lon, result.label);
  };

  return (
    <View style={[styles.card, isOutside && styles.cardOutside]}>
      <View style={styles.headingRow}>
        <Ionicons
          name={isOutside ? "alert-circle-outline" : "location-outline"}
          size={20}
          color={isOutside ? colors.destructive : colors.primary}
        />
        <Text style={styles.heading}>
          {isOutside ? "Outside our delivery area" : "Confirm your location"}
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.actions}>
        {failure === "blocked" || failure === "unavailable" ? (
          <Pressable
            style={styles.primaryButton}
            onPress={onOpenSettings}
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={16} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryButton, isLocating && styles.buttonDisabled]}
            onPress={() => void onRetryDeviceLocation()}
            disabled={isLocating}
            accessibilityRole="button"
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="navigate-outline" size={16} color={colors.primaryForeground} />
            )}
            <Text style={styles.primaryButtonText}>
              {isLocating
                ? "Finding you…"
                : failure
                  ? "Try again"
                  : "Share my location"}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.orLabel}>or enter your address</Text>

      {/* Typing is enabled here on purpose: when a permission is refused for
          good, "Locate me" is exactly what cannot work, so an address the
          customer picks themselves is the only way through. */}
      <LocationAutocomplete
        placeholder={"Search for your address…"}
        allowManualEntry
        focusOnLahore
        showUseMyLocation={false}
        onLocationSelect={handleSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardOutside: {
    borderColor: colors.destructive,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heading: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
    flexShrink: 1,
  },
  message: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.primaryForeground,
  },
  orLabel: {
    ...typography.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
