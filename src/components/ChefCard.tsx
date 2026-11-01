import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/context";
import { MatchedDish } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { FavoriteButton } from "@/components/FavoriteButton";
import { toTitleCase } from "@/lib/titleCase";

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
  /** Keep room for the matching-dishes block even when this chef has none, so
   *  every card in a search result is the same height. */
  reserveMatchedSlot?: boolean;
  onPress: () => void;
}

// Every card in the grid is the same height: each optional section keeps a
// fixed-height slot whether or not it has anything to show, and anything that
// could wrap is held to one line.
const MAX_TAGS = 2;
const MAX_MATCHED = 2;

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
  reserveMatchedSlot = false,
  onPress,
}: ChefCardProps) => {
  const { formatPrice } = useI18n();
  const isOffline = isOpenNow === false;
  // A chef with no specialties listed reads "Diverse", as on the website, so
  // the tag row is never an empty gap.
  const displayedSpecialties = specialties.length > 0 ? specialties.slice(0, MAX_TAGS) : ["Diverse"];
  const shownMatches = matchedDishes.slice(0, MAX_MATCHED);
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
            <Ionicons name="star" size={11} color={colors.accent} />
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

        <View style={styles.locationRow}>
          {typeof distanceKm === "number" && (
            <>
              <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
              <Text style={styles.locationText} numberOfLines={1}>
                {distanceKm.toFixed(1)} km away
              </Text>
            </>
          )}
        </View>

        {/* Specialties tags — one row, never wrapping */}
        <View style={styles.tagsRow}>
          {displayedSpecialties.map((s) => (
            <View key={s} style={[styles.tag, styles.tagShrink]}>
              <Text style={styles.tagText} numberOfLines={1}>{s}</Text>
            </View>
          ))}
          {specialties.length > MAX_TAGS && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>+{specialties.length - MAX_TAGS}</Text>
            </View>
          )}
        </View>

        {/* Why this chef matched: the dishes on their menu that hit the search term. */}
        {shownMatches.length > 0 ? (
          <View style={styles.matchedBlock}>
            <View style={styles.matchedHeader}>
              <Ionicons name="restaurant-outline" size={10} color={colors.mutedForeground} />
              <Text style={styles.matchedLabel}>Matching dishes</Text>
            </View>
            {shownMatches.map((dish) => (
              <View key={dish.id} style={styles.matchedRow}>
                <Text style={styles.matchedTitle} numberOfLines={1}>
                  {toTitleCase(dish.title)}
                </Text>
                <Text style={styles.matchedPrice}>{formatPrice(dish.price)}</Text>
              </View>
            ))}
          </View>
        ) : reserveMatchedSlot ? (
          <View style={styles.matchedSlot} />
        ) : null}

        {/* Footer: price range + CTA */}
        <View style={styles.footer}>
          {(minPrice > 0 || maxPrice > 0) ? (
            <Text style={styles.priceRange} numberOfLines={1}>
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

// Header line plus MAX_MATCHED dish rows.
const MATCHED_SLOT_HEIGHT = 56;

const styles = StyleSheet.create({
  card: {
    // Grow (not flex: 1) so the card keeps its content height on its own and
    // still stretches to the tallest card in its row.
    flexGrow: 1,
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
    color: colors.white,
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
    // Orange, matching the web chef card's open-now badge.
    backgroundColor: colors.secondaryStrong,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  openBadgeText: { fontSize: 10, fontWeight: "700", color: colors.white },
  offlineBadge: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  offlineBadgeText: { fontSize: 10, fontWeight: "700", color: colors.white },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 16,
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

  content: { flexGrow: 1, padding: spacing.sm },
  name: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    height: 20,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  tagShrink: { flexShrink: 1 },
  tag: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: {
    ...typography.xs,
    color: colors.accentSubtleForeground,
    fontWeight: "600",
  },

  matchedBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    marginBottom: spacing.xs,
    gap: 2,
    height: MATCHED_SLOT_HEIGHT,
    overflow: "hidden",
  },
  matchedSlot: { height: MATCHED_SLOT_HEIGHT, marginBottom: spacing.xs },
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
    // Pinned to the bottom so cards line up even if a slot renders short.
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
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
