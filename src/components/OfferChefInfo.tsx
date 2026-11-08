import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { OfferChefSummary } from "@/services/types";
import { colors, spacing, typography, radius } from "@/constants/theme";

interface Props {
  chefId: number;
  /** Name to show when the server sent no summary (older backend). */
  fallbackName: string;
  chef?: OfferChefSummary | null;
  /** When the offer was made (ISO string). */
  offeredAt?: string;
  muted?: boolean;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The chef behind an offer: photo, tappable kitchen name, and the facts a
 *  customer compares offers on. Tapping opens the chef's profile. */
export function OfferChefInfo({ chefId, fallbackName, chef, offeredAt, muted }: Props) {
  const name = chef?.name ?? fallbackName;
  const openProfile = () => router.push(`/chef/${chefId}`);
  const specialties = chef?.specialties?.slice(0, 3) ?? [];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={openProfile}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel={`View ${name}'s profile`}
      >
        {chef?.profile_picture_url ? (
          <Image source={{ uri: chef.profile_picture_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.body}>
        <Pressable onPress={openProfile} hitSlop={6} accessibilityRole="link">
          <Text style={[styles.name, muted && styles.muted]} numberOfLines={1}>
            {name}
            <Text style={styles.chevron}>  ›</Text>
          </Text>
        </Pressable>

        {(chef || offeredAt) && (
          <View style={styles.facts}>
            {chef && (<>
            {chef.review_count > 0 ? (
              <View style={styles.fact}>
                <Ionicons name="star" size={12} color={colors.rating} />
                <Text style={styles.factStrong}>{chef.rating_avg.toFixed(1)}</Text>
                <Text style={styles.factText}>({plural(chef.review_count, "review")})</Text>
              </View>
            ) : (
              <View style={styles.fact}>
                <Ionicons name="star-outline" size={12} color={colors.mutedForeground} />
                <Text style={styles.factText}>New</Text>
              </View>
            )}
            <View style={styles.fact}>
              <Ionicons name="bag-check-outline" size={12} color={colors.mutedForeground} />
              <Text style={styles.factText}>{plural(chef.completed_orders, "order")} completed</Text>
            </View>
            {typeof chef.years_of_experience === "number" && chef.years_of_experience > 0 && (
              <View style={styles.fact}>
                <Ionicons name="ribbon-outline" size={12} color={colors.mutedForeground} />
                <Text style={styles.factText}>{plural(chef.years_of_experience, "yr")} experience</Text>
              </View>
            )}
            {typeof chef.distance_km === "number" && (
              <View style={styles.fact}>
                <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                <Text style={styles.factText}>{chef.distance_km.toFixed(1)} km away</Text>
              </View>
            )}
            </>)}
            {offeredAt && (
              <View style={styles.fact}>
                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                <Text style={styles.factText}>
                  Offered{" "}
                  {new Date(offeredAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        {specialties.length > 0 && (
          <View style={styles.chips}>
            {specialties.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: radius.full },
  avatarFallback: {
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.sm, fontWeight: "700", color: colors.primary },
  body: { flex: 1, minWidth: 0 },
  name: { ...typography.base, fontWeight: "600", color: colors.primary },
  chevron: { color: colors.mutedForeground, fontWeight: "400" },
  muted: { color: colors.mutedForeground },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.sm, rowGap: 2, marginTop: 2 },
  fact: { flexDirection: "row", alignItems: "center", gap: 3 },
  factText: { ...typography.xs, color: colors.mutedForeground },
  factStrong: { ...typography.xs, fontWeight: "700", color: colors.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, lineHeight: 15, color: colors.mutedForeground },
});
