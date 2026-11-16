import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { requestService } from "@/services/requestService";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";

type Summary = Awaited<ReturnType<typeof requestService.getOpenRequestSummary>>;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/**
 * A customer's requests, one tap from Home.
 *
 * The banner above this posts a request; this is the way back to the ones
 * already posted, which otherwise live only under the Profile tab. With
 * requests open it is a strip saying what is waiting — orange once offers have
 * come in, since that is when the customer has something to do. With nothing
 * open (or if the count cannot be loaded) it shrinks to a plain "My Requests"
 * link. Signed-out visitors get nothing.
 */
export function RequestTrackerStrip() {
  const { dbUser } = useAuth();
  const customerId = dbUser?.id ?? null;
  const [summary, setSummary] = useState<Summary | null>(null);

  // Refetched on every focus: offers arrive while the customer is elsewhere.
  useFocusEffect(
    useCallback(() => {
      if (customerId == null) {
        setSummary(null);
        return;
      }
      let cancelled = false;
      requestService
        .getOpenRequestSummary(customerId)
        .then((s) => {
          if (!cancelled) setSummary(s);
        })
        .catch(() => {
          if (!cancelled) setSummary(null);
        });
      return () => {
        cancelled = true;
      };
    }, [customerId])
  );

  if (customerId == null) return null;

  if (!summary || summary.openCount === 0) {
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/my-requests")}
        hitSlop={8}
        accessibilityRole="link"
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Ionicons name="document-text-outline" size={14} color={colors.secondaryStrong} />
        <Text style={styles.linkText}>My Requests</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.secondaryStrong} />
      </Pressable>
    );
  }

  const { openCount, pendingOffers, onlyRequestId } = summary;
  const hasOffers = (pendingOffers ?? 0) > 0;
  const openLabel = plural(openCount, "1 open request", "open requests");
  const label = hasOffers
    ? pendingOffers === 1
      ? "1 offer waiting on your request"
      : `${pendingOffers} offers waiting on your requests`
    : // Only claim nobody has offered when the server actually told us so.
      pendingOffers === 0
      ? `${openLabel} — waiting for chefs' offers`
      : openLabel;
  const tint = hasOffers ? colors.secondaryForeground : colors.foreground;

  return (
    <Pressable
      onPress={() =>
        onlyRequestId != null
          ? router.push(`/my-requests/${onlyRequestId}`)
          : router.push("/(tabs)/my-requests")
      }
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hasOffers ? "Review offers" : "Track"}`}
      style={({ pressed }) => [styles.strip, hasOffers && styles.stripActive, pressed && styles.pressed]}
    >
      <View style={[styles.icon, hasOffers && styles.iconActive]}>
        <Ionicons name="document-text-outline" size={16} color={tint} />
      </View>
      <Text style={[styles.label, { color: tint }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.action, { color: hasOffers ? tint : colors.secondaryStrong }]}>
        {hasOffers ? "Review" : "Track"}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={hasOffers ? tint : colors.secondaryStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  stripActive: {
    backgroundColor: colors.secondaryStrong,
    borderColor: colors.secondaryStrong,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  iconActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  label: {
    flex: 1,
    ...typography.sm,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
  },
  action: {
    ...typography.sm,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.sm,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.secondaryStrong,
  },
  pressed: { opacity: 0.85 },
});
