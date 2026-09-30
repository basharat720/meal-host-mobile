import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/context";
import { CuisineType } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { formatDuration } from "@/lib/duration";
import { FavoriteButton } from "@/components/FavoriteButton";

interface DishCardProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  chefId: string;
  chefName: string;
  isVeg?: boolean;
  rating?: number;
  /** True when the dish is priced by variant — the card then sends to detail. */
  hasVariants?: boolean;
  preparationTimeMinutes?: number;
  isChefOffline?: boolean;
  /** Optional cuisine chips shown under the dish name. */
  cuisineTypes?: CuisineType[];
  /** When true, shows a "Popular" badge (hidden while the dish is unavailable). */
  isPopular?: boolean;
  /** Optional message shown when the chef is offline, e.g. "Opens Saturday 09:00". */
  offlineMessage?: string;
}

export const DishCard = ({
  id, name, description, price, image, chefId, chefName,
  isVeg = false, rating, hasVariants = false, preparationTimeMinutes,
  isChefOffline = false, cuisineTypes = [], isPopular = false, offlineMessage,
}: DishCardProps) => {
  const { addItem, switchChefAndAdd } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 2 - spacing.sm) / 2;

  // Stock tracking is gone: only the chef's schedule blocks ordering now.
  const orderDisabled = isChefOffline;
  const displayedCuisines = cuisineTypes.slice(0, 2);

  const handleAddToCart = () => {
    if (orderDisabled) return;
    // A variant-priced dish needs a choice before it can go in the cart.
    if (hasVariants) {
      router.push(`/dish/${id}`);
      return;
    }
    const result = addItem({ foodListingId: id, name, price, image, chefId, chefName });
    if (result.success) {
      showToast({ message: `${name} added to cart`, variant: "success" });
      return;
    }
    if (result.requiresSwitch && result.pendingItem) {
      Alert.alert("Switch Chef?", result.message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          style: "destructive",
          onPress: () => {
            switchChefAndAdd(result.pendingItem!);
            showToast({ message: `${name} added to cart`, variant: "success" });
          },
        },
      ]);
    } else if (result.message) {
      Alert.alert("Can't Add", result.message);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/dish/${id}`)}
      style={[styles.card, { width: cardWidth }, isChefOffline && { opacity: 0.7 }]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        {isVeg && !isChefOffline && (
          <View style={styles.vegBadge}>
            <Text style={styles.vegText}>🌿 Veg</Text>
          </View>
        )}
        <FavoriteButton type="dish" id={id} label={name} />
        {isChefOffline ? (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>Chef offline</Text>
          </View>
        ) : isPopular ? (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Popular</Text>
          </View>
        ) : null}
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); handleAddToCart(); }}
          style={[styles.addButton, orderDisabled && styles.addButtonDisabled]}
          hitSlop={8}
          disabled={orderDisabled}
        >
          <Ionicons
            name={orderDisabled ? "close" : hasVariants ? "options-outline" : "add"}
            size={18}
            color={colors.white}
          />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {description ? <Text style={styles.description} numberOfLines={1}>{description}</Text> : null}

        {displayedCuisines.length > 0 && (
          <View style={styles.cuisineRow}>
            {displayedCuisines.map((c) => (
              <View key={c.id} style={styles.cuisineChip}>
                <Text style={styles.cuisineText} numberOfLines={1}>{c.name}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.chefName} numberOfLines={1}>{chefName}</Text>

        {isChefOffline ? (
          <Text style={styles.offlineNote} numberOfLines={1}>{offlineMessage || "Chef offline"}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.price}>
            {hasVariants ? `From ${formatPrice(price)}` : formatPrice(price)}
          </Text>
          <View style={styles.meta}>
            {!!rating && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={11} color={colors.warning} />
                <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {!!preparationTimeMinutes && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{formatDuration(preparationTimeMinutes, { compact: true })}</Text>
              </View>
            )}
          </View>
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
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  imageContainer: { position: "relative", aspectRatio: 4 / 3, backgroundColor: colors.muted },
  image: { width: "100%", height: "100%" },
  vegBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2,
  },
  vegText: { fontSize: 10, fontWeight: "600", color: colors.successSubtleForeground },
  offlineBadge: {
    position: "absolute", bottom: 6, left: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3,
  },
  offlineText: { fontSize: 10, fontWeight: "600", color: colors.white },
  popularBadge: {
    position: "absolute", bottom: 6, left: 6,
    backgroundColor: colors.secondaryStrong,
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3,
  },
  popularText: { fontSize: 10, fontWeight: "700", color: colors.white },
  addButton: {
    position: "absolute", bottom: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadow.md,
  },
  addButtonDisabled: {
    backgroundColor: colors.mutedForeground,
  },
  content: { padding: spacing.sm },
  name: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  description: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  cuisineRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  cuisineChip: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: "100%",
  },
  cuisineText: { fontSize: 10, fontWeight: "600", color: colors.accentSubtleForeground },
  chefName: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  offlineNote: { ...typography.xs, fontWeight: "600", color: colors.mutedForeground, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  price: { ...typography.sm, fontWeight: "800", color: colors.foreground },
  meta: { flexDirection: "row", gap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  metaText: { ...typography.xs, color: colors.mutedForeground },
});
