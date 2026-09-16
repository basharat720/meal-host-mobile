import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/context";
import { MatchedDish } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { FavoriteButton } from "@/components/FavoriteButton";

export interface ChefCardProps {
  id: string;
  name: string;
  image?: string | null;
  specialties?: string[];
  rating: number;
  reviews: number;
  minPrice?: number;
  maxPrice?: number;
  isVeg?: boolean;
  isOpenNow?: boolean;
  /** Dishes that matched the search term, shown so the user sees why this chef surfaced. */
  matchedDishes?: MatchedDish[];
  /** Distance from the customer in km, when their location is known. */
  distanceKm?: number | null;
  onPress: () => void;
}

export const ChefCard = ({
  id,
  name,
  image,
  specialties = [],
  rating,
  reviews,
  minPrice = 0,
  maxPrice = 0,
  isVeg,
  isOpenNow = true,
  matchedDishes = [],
  distanceKm,
  onPress,
}: ChefCardProps) => {
  const { formatPrice } = useI18n();
  const isOffline = isOpenNow === false;
  const displayedSpecialties = specialties.slice(0, 3);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, isOffline && styles.cardOffline, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* Avatar / Photo */}
      <View style={styles.imageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}

        {/* Badges overlay */}
        <View style={styles.badgesRow}>
          {isVeg && (
            <View style={styles.vegBadge}>
              <Text style={styles.badgeText}>🌿 Veg</Text>
            </View>
          )}
        </View>

        <FavoriteButton type="chef" id={id} label={name} />

        {/* Rating pill — hidden until the chef has been rated */}
        {rating > 0 && (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color={colors.warning} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            {reviews > 0 && (
              <Text style={styles.reviewsText}>({reviews})</Text>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>

        {/* Open / offline status, on its own line under the name */}
        <View style={styles.statusRow}>
          {isOffline ? (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>Offline</Text>
            </View>
          ) : (
            <View style={styles.openBadge}>
              <View style={styles.openDot} />
              <Text style={styles.openBadgeText}>Open now</Text>
            </View>
          )}
        </View>

        {typeof distanceKm === "number" && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
            <Text style={styles.locationText} numberOfLines={1}>
              {distanceKm.toFixed(1)} km away
            </Text>
          </View>
        )}

        {/* Specialties tags */}
        {displayedSpecialties.length > 0 && (
          <View style={styles.tagsRow}>
            {displayedSpecialties.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))}
            {specialties.length > 3 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>+{specialties.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Why this chef matched: the dishes on their menu that hit the search term. */}
        {matchedDishes.length > 0 && (
          <View style={styles.matchedBlock}>
            <View style={styles.matchedHeader}>
              <Ionicons name="restaurant-outline" size={10} color={colors.mutedForeground} />
              <Text style={styles.matchedLabel}>Matching dishes</Text>
            </View>
            {matchedDishes.map((dish) => (
              <View key={dish.id} style={styles.matchedRow}>
                <Text style={styles.matchedTitle} numberOfLines={1}>
                  {dish.title}
                </Text>
                <Text style={styles.matchedPrice}>{formatPrice(dish.price)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer: price range + CTA */}
        <View style={styles.footer}>
          {(minPrice > 0 || maxPrice > 0) ? (
            <Text style={styles.priceRange}>
              {minPrice === maxPrice
                ? formatPrice(minPrice)
                : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}
            </Text>
          ) : (
            <Text style={styles.priceRange}>View menu</Text>
          )}
          <Text style={styles.ctaText}>Menu →</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
  cardOffline: { opacity: 0.72 },
  pressed: { opacity: 0.88 },

  imageContainer: {
    position: "relative",
    aspectRatio: 4 / 3,
    backgroundColor: colors.muted,
  },
  image: { width: "100%", height: "100%" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightSage,
  },
  avatarInitials: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.primary,
  },

  badgesRow: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    gap: 4,
  },
  vegBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },

  statusRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.success,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  openBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  offlineBadge: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  offlineBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: spacing.xs,
  },
  locationText: {
    ...typography.xs,
    color: colors.mutedForeground,
    flex: 1,
  },

  ratingPill: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: radius.md,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.foreground,
  },
  reviewsText: {
    ...typography.xs,
    color: colors.mutedForeground,
  },

  content: { padding: spacing.sm },
  name: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: spacing.xs,
  },
  tag: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    ...typography.xs,
    color: colors.primary,
    fontWeight: "600",
  },

  matchedBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    marginBottom: spacing.xs,
    gap: 2,
  },
  matchedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  matchedLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  matchedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  matchedTitle: { ...typography.xs, color: colors.foreground, flex: 1 },
  matchedPrice: { ...typography.xs, color: colors.mutedForeground },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  priceRange: {
    ...typography.xs,
    color: colors.mutedForeground,
    flex: 1,
  },
  ctaText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.primary,
  },
});
