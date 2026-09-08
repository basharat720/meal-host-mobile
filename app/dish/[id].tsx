import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { DishCard } from "@/components/DishCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/context";
import { dishService, menuService, availabilityService } from "@/services/api";
import { FoodListing, ChefAvailabilityStatus } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { formatDuration } from "@/lib/duration";

// "HH:MM" (24h) -> "9:00 AM" (12h) for display.
function displayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 0;
  const min = Number.isFinite(m) ? m : 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

function primaryImage(dish: FoodListing): string {
  return (
    dish.images?.find((img) => img.is_primary)?.image_url ??
    dish.images?.[0]?.image_url ??
    ""
  );
}

function isVegListing(dish: FoodListing): boolean {
  return (dish.dietary_tags ?? []).some(
    (t) => t.code === "VEG" || t.code === "VEGETARIAN" || t.code === "VEGAN"
  );
}

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem, switchChefAndAdd } = useCart();
  const { showToast } = useToast();
  const { formatPrice } = useI18n();

  const [dish, setDish] = useState<FoodListing | null>(null);
  const [chefDishes, setChefDishes] = useState<FoodListing[]>([]);
  const [status, setStatus] = useState<ChefAvailabilityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      const data = await dishService.getDish(Number(id));
      setDish(data);
      setQuantity((q) => {
        // Keep the selection valid against the freshly-loaded stock.
        const max = data.available_quantity > 0 ? data.available_quantity : 1;
        return Math.min(Math.max(q, 1), max);
      });

      // Availability + sibling dishes are best-effort; never block the page.
      const [statusRes, listingsRes] = await Promise.allSettled([
        availabilityService.getStatus(data.chef_id),
        menuService.getChefListingsPublic(data.chef_id),
      ]);
      setStatus(statusRes.status === "fulfilled" ? statusRes.value : null);
      if (listingsRes.status === "fulfilled") {
        setChefDishes(
          listingsRes.value
            .filter((l) => l.status === "ACTIVE" && l.id !== data.id)
            .slice(0, 4)
        );
      } else {
        setChefDishes([]);
      }
    } catch {
      if (!silent) setFetchError("We couldn't load this dish right now.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [load])
  );

  if (isLoading) {
    return <FullScreenLoader message="Loading dish..." />;
  }

  if (fetchError || !dish) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.errorTitle}>{fetchError ?? "Dish not found"}</Text>
          <View style={styles.errorActions}>
            <Button variant="outline" onPress={() => router.push("/(tabs)/chefs")} style={styles.errorBtn}>
              Back to Home
            </Button>
            <Button onPress={() => load()} style={styles.errorBtn}>
              Retry
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // The live availability status is authoritative; the listing flag is a
  // fallback for when the status call fails. Either saying "offline" blocks
  // ordering, so a missing/true listing flag can't re-enable the Add button.
  const isChefOffline = dish.chef_is_available === false || status?.is_open === false;
  const isOutOfStock = dish.available_quantity <= 0;
  const isLowStock = dish.available_quantity > 0 && dish.available_quantity <= 3;
  const orderDisabled = isOutOfStock || isChefOffline;
  const image = primaryImage(dish);
  const isVeg = isVegListing(dish);
  const chefName = dish.chef_name || "Chef";
  const offlineMessage =
    status && !status.is_open && status.next_open_day_label && status.next_open_time
      ? `Opens ${status.next_open_day_label} ${displayTime(status.next_open_time)}`
      : "Chef offline";

  const incrementQuantity = () => {
    setQuantity((q) => (q < dish.available_quantity ? q + 1 : q));
  };
  const decrementQuantity = () => {
    setQuantity((q) => (q > 1 ? q - 1 : q));
  };

  const cartItem = {
    id: dish.id.toString(),
    name: dish.title,
    price: dish.price,
    image,
    chefId: dish.chef_id,
    chefName,
  };

  const addRemaining = () => {
    // First unit already added by the caller; top up the rest, respecting the cap.
    for (let i = 1; i < quantity; i++) {
      const r = addItem(cartItem, dish.available_quantity);
      if (!r.success) {
        if (r.message) Alert.alert("Can't Add", r.message);
        break;
      }
    }
  };

  const confirmAdded = () => {
    showToast({
      message: `${quantity} × ${dish.title} added to cart`,
      variant: "success",
    });
  };

  const handleAddToCart = () => {
    if (orderDisabled) return;
    const first = addItem(cartItem, dish.available_quantity);
    if (!first.success) {
      if (first.requiresSwitch && first.pendingItem) {
        Alert.alert("Switch Chef?", first.message, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch",
            style: "destructive",
            onPress: () => {
              switchChefAndAdd(first.pendingItem!, dish.available_quantity);
              addRemaining();
              confirmAdded();
            },
          },
        ]);
      } else if (first.message) {
        Alert.alert("Can't Add", first.message);
      }
      return;
    }
    addRemaining();
    confirmAdded();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Back bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.imageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.heroImage} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <Ionicons name="fast-food-outline" size={40} color={colors.mutedForeground} />
            </View>
          )}
          {isVeg && !isChefOffline && (
            <View style={styles.vegBadge}>
              <Text style={styles.vegText}>🌿 Veg</Text>
            </View>
          )}
        </View>

        {/* Title + chef */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{dish.title}</Text>
            {isChefOffline ? (
              <Badge label="Chef offline" variant="default" />
            ) : isOutOfStock ? (
              <Badge label="Sold out" variant="destructive" />
            ) : isLowStock ? (
              <Badge label={`Only ${dish.available_quantity} left`} variant="warning" />
            ) : (
              <Badge label="Available" variant="success" />
            )}
          </View>

          <Pressable style={styles.chefRow} onPress={() => router.push(`/chef/${dish.chef_id}/menu`)} hitSlop={6}>
            <Ionicons name="restaurant-outline" size={15} color={colors.mutedForeground} />
            <Text style={styles.chefName}>{chefName}</Text>
            {!!dish.chef_rating_avg && dish.chef_rating_avg > 0 && (
              <>
                <Text style={styles.dot}>•</Text>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.chefRating}>{dish.chef_rating_avg.toFixed(1)}</Text>
                {!!dish.chef_review_count && (
                  <Text style={styles.chefReviews}>({dish.chef_review_count})</Text>
                )}
              </>
            )}
            <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} style={styles.chefChevron} />
          </Pressable>

          {isChefOffline && (
            <View style={styles.offlineNoteRow}>
              <Ionicons name="moon-outline" size={13} color={colors.mutedForeground} />
              <Text style={styles.offlineNote}>{offlineMessage}</Text>
            </View>
          )}

          {!!dish.description && <Text style={styles.description}>{dish.description}</Text>}

          {/* Dietary + cuisine chips */}
          {(dish.dietary_tags.length > 0 || (dish.cuisine_types?.length ?? 0) > 0) && (
            <View style={styles.chipsWrap}>
              {dish.dietary_tags.map((tag) => (
                <View key={`d-${tag.id}`} style={[styles.chip, styles.chipOutline]}>
                  <Text style={styles.chipOutlineText}>{tag.description || tag.code}</Text>
                </View>
              ))}
              {(dish.cuisine_types ?? []).map((c) => (
                <View key={`c-${c.id}`} style={styles.chip}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick info */}
          <View style={styles.infoRow}>
            {!!dish.preparation_time_minutes && (
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{formatDuration(dish.preparation_time_minutes)} prep</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text style={styles.infoText}>Pickup available</Text>
            </View>
          </View>
        </View>

        {/* Price + quantity + add to cart */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(dish.price)}</Text>
            {!orderDisabled && (
              <View style={styles.qtySelector}>
                <Pressable
                  style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={decrementQuantity}
                  disabled={quantity <= 1}
                  hitSlop={6}
                >
                  <Ionicons name="remove" size={18} color={quantity <= 1 ? colors.mutedForeground : colors.foreground} />
                </Pressable>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <Pressable
                  style={[styles.qtyBtn, quantity >= dish.available_quantity && styles.qtyBtnDisabled]}
                  onPress={incrementQuantity}
                  disabled={quantity >= dish.available_quantity}
                  hitSlop={6}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={quantity >= dish.available_quantity ? colors.mutedForeground : colors.foreground}
                  />
                </Pressable>
              </View>
            )}
          </View>

          {isLowStock && !orderDisabled && (
            <Text style={styles.lowStockWarn}>Hurry! Only {dish.available_quantity} servings left.</Text>
          )}

          <Button
            size="lg"
            onPress={handleAddToCart}
            disabled={orderDisabled}
            style={styles.addBtn}
          >
            {isChefOffline
              ? "Chef Not Available"
              : isOutOfStock
              ? "Sold Out"
              : `Add ${quantity > 1 ? `${quantity} × ` : ""}${formatPrice(dish.price * quantity)}`}
          </Button>
        </View>

        {/* More from this chef */}
        {chefDishes.length > 0 && (
          <View style={styles.moreSection}>
            <View style={styles.moreHeader}>
              <Text style={styles.moreTitle}>More from {chefName}</Text>
              <Pressable onPress={() => router.push(`/chef/${dish.chef_id}/menu`)} hitSlop={6}>
                <Text style={styles.viewAll}>View all →</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {chefDishes.map((d) => (
                <DishCard
                  key={d.id}
                  id={d.id.toString()}
                  name={d.title}
                  description={d.description}
                  price={d.price}
                  image={primaryImage(d)}
                  chefId={d.chef_id}
                  chefName={d.chef_name || chefName}
                  isVeg={isVegListing(d)}
                  rating={d.chef_rating_avg}
                  availableQty={d.available_quantity}
                  preparationTimeMinutes={d.preparation_time_minutes}
                  // Same chef as the dish above, so it shares its offline state.
                  isChefOffline={isChefOffline || d.chef_is_available === false}
                  offlineMessage={offlineMessage}
                  cuisineTypes={d.cuisine_types}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backLabel: { ...typography.sm, color: colors.mutedForeground, marginLeft: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing["3xl"], gap: spacing.sm },

  imageWrap: {
    position: "relative",
    aspectRatio: 4 / 3,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.muted,
  },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  vegBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vegText: { fontSize: 11, fontWeight: "600", color: "#166534" },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.sm,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  title: { ...typography["2xl"], fontWeight: "700", color: colors.foreground, flex: 1 },

  chefRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chefName: { ...typography.sm, fontWeight: "600", color: colors.foreground },
  dot: { ...typography.sm, color: colors.mutedForeground },
  chefRating: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  chefReviews: { ...typography.xs, color: colors.mutedForeground },
  chefChevron: { marginLeft: "auto" },

  offlineNoteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  offlineNote: { ...typography.xs, fontWeight: "600", color: colors.mutedForeground },

  description: { ...typography.sm, color: colors.mutedForeground, lineHeight: 20 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { ...typography.xs, fontWeight: "600", color: colors.primary },
  chipOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  chipOutlineText: { ...typography.xs, fontWeight: "500", color: colors.foreground },

  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { ...typography.sm, color: colors.mutedForeground },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { ...typography["3xl"], fontWeight: "800", color: colors.foreground },

  qtySelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  qtyBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  qtyBtnDisabled: { backgroundColor: colors.muted },
  qtyValue: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
    minWidth: 40,
    textAlign: "center",
  },

  lowStockWarn: { ...typography.xs, fontWeight: "600", color: colors.destructive },
  addBtn: { marginTop: spacing.xs },

  moreSection: { marginTop: spacing.sm, gap: spacing.sm },
  moreHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moreTitle: { ...typography.lg, fontWeight: "700", color: colors.foreground },
  viewAll: { ...typography.sm, fontWeight: "700", color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  errorTitle: { ...typography.lg, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  errorActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  errorBtn: { flex: 1 },
});
