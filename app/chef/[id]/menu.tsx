import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { DishCard } from "@/components/DishCard";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  chefService,
  menuService,
  availabilityService,
  reviewService,
} from "@/services/api";
import {
  Chef,
  FoodListing,
  ChefAvailabilityStatus,
  Review,
  AvailabilitySlot,
} from "@/services/types";
import { useAuth } from "@/contexts/AuthContext";
import { chefDisplayName } from "@/lib/chefName";
import { FavoriteButton } from "@/components/FavoriteButton";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { getListingStartingPrice } from "@/lib/listingVariants";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// How many reviews to surface inline before deferring to the dedicated screen.
const REVIEW_PREVIEW_COUNT = 2;

// "HH:MM" (24h) -> "9:00 AM" (12h) for display.
function displayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 0;
  const min = Number.isFinite(m) ? m : 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

function StarRow({ stars }: { stars: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= stars ? "star" : "star-outline"}
          size={12}
          color={n <= stars ? colors.accent : colors.border}
        />
      ))}
    </View>
  );
}

interface MappedChef {
  id: string;
  /** Numeric chef id. `id` above is the firebase_uid this screen looks up by. */
  chefId: number;
  name: string;
  image: string | null;
  cuisine: string;
  rating: number;
  location: string;
  bio: string;
  isVerified: boolean;
  isVeg: boolean;
  isActive: boolean;
  specialties: string[];
  dietaryTags: string[];
  foodSafetyBadges: string[];
}

function mapChefForDisplay(chef: Chef, listings: FoodListing[]): MappedChef {
  const profile = chef.chef_profile;
  const specialties = profile?.specialties ?? chef.specialties ?? [];
  const dietaryTags = profile?.dietary_tags ?? chef.dietary_tags ?? [];
  return {
    id: chef.firebase_uid,
    chefId: chef.id,
    // Every name shown on this screen flows from here, so resolving the
    // kitchen name once covers the header, the dish cards and the CTA.
    name: chefDisplayName(chef),
    image: profile?.profile_picture_url ?? null,
    cuisine: specialties.join(", ") || "Diverse",
    rating: profile?.rating_avg ?? 0,
    location:
      chef.locations?.find((l) => l.is_primary)?.address ?? "Local Kitchen",
    bio:
      profile?.kitchen_description ??
      "Passionate home cook sharing authentic family recipes.",
    isVerified: chef.status === "VERIFIED" || profile?.status === "active",
    isActive: profile?.status === "active",
    isVeg:
      dietaryTags.some(
        (t) => t.toUpperCase() === "VEG" || t.toUpperCase() === "VEGETARIAN"
      ) ||
      listings.some((l) =>
        l.dietary_tags?.some(
          (t) => t.code === "VEG" || t.code === "VEGETARIAN"
        )
      ),
    specialties,
    dietaryTags,
    foodSafetyBadges: profile?.food_safety_badge ?? [],
  };
}

export default function ChefMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dbUser } = useAuth();

  // Start a custom dish request targeted at this specific chef. Mirrors the web
  // ChefMenuPage: signed-in users go straight to the request form (pre-scoped to
  // this chef via chefId); otherwise send them to login and preserve the
  // targeted-chef destination so they land back here after signing in.
  const handleRequestFromChef = useCallback(() => {
    if (dbUser) {
      router.push({ pathname: "/(tabs)/post-request", params: { chefId: id } });
    } else {
      router.push({
        pathname: "/(auth)/customer-login",
        params: { redirect: `/(tabs)/post-request?chefId=${id}` },
      });
    }
  }, [dbUser, id]);

  const [chef, setChef] = useState<MappedChef | null>(null);
  const [menuItems, setMenuItems] = useState<FoodListing[]>([]);
  const [status, setStatus] = useState<ChefAvailabilityStatus | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    // Keep the current menu on screen while refetching silently.
    if (!silent) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      // The menu and chef profile now live on one screen, so pull the reviews and
      // weekly schedule here too. Everything except the chef record + listings is
      // best-effort — never block the menu on it.
      const [chefData, listings, statusData, reviewsData, slotsData] =
        await Promise.all([
          chefService.getChef(id),
          menuService.getChefListingsPublic(id),
          availabilityService.getStatus(id).catch(() => null),
          reviewService.getChefReviews(Number(id)).catch(() => []),
          availabilityService.getAvailability(Number(id)).catch(() => []),
        ]);
      const activeListings = listings.filter((l) => l.status === "ACTIVE");
      setChef(mapChefForDisplay(chefData, activeListings));
      setMenuItems(activeListings);
      setStatus(statusData);
      setReviews(reviewsData);
      setSlots(slotsData);
    } catch {
      if (!silent) setFetchError("We couldn't load this chef's menu right now.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Refetch the menu whenever the screen regains focus so it stays current.
  useFocusEffect(
    useCallback(() => {
      loadData(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const isChefOffline = status ? !status.is_open : false;

  const renderItem = useCallback(
    ({ item, index }: { item: FoodListing; index: number }) => {
      if (index % 2 === 1) return null; // pairs rendered together
      const next = menuItems[index + 1];
      const primaryImage = (l: FoodListing) =>
        l.images?.find((i) => i.is_primary)?.image_url ??
        l.images?.[0]?.image_url ??
        "";
      const isVeg = (l: FoodListing) =>
        l.dietary_tags?.some(
          (t) => t.code === "VEG" || t.code === "VEGETARIAN"
        ) ?? false;

      return (
        <View style={styles.row}>
          <DishCard
            id={item.id.toString()}
            name={item.title}
            description={item.description}
            price={getListingStartingPrice(item) ?? 0}
            image={primaryImage(item)}
            chefId={id ?? ""}
            chefName={chef?.name ?? ""}
            isVeg={isVeg(item)}
            rating={chef?.rating}
            hasVariants={item.has_variants}
            preparationTimeMinutes={item.preparation_time_minutes}
            isChefOffline={isChefOffline}
          />
          {next ? (
            <DishCard
              id={next.id.toString()}
              name={next.title}
              description={next.description}
              price={getListingStartingPrice(next) ?? 0}
              image={primaryImage(next)}
              chefId={id ?? ""}
              chefName={chef?.name ?? ""}
              isVeg={isVeg(next)}
              rating={chef?.rating}
              hasVariants={next.has_variants}
              preparationTimeMinutes={next.preparation_time_minutes}
              isChefOffline={isChefOffline}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      );
    },
    [menuItems, chef, id, isChefOffline]
  );

  if (isLoading) {
    return <FullScreenLoader message="Loading menu..." />;
  }

  if (fetchError || !chef) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.destructive}
          />
          <Text style={styles.errorTitle}>
            {fetchError ?? "Chef not found"}
          </Text>
          <View style={styles.errorActions}>
            <Button
              variant="outline"
              onPress={() => router.push("/(tabs)/chefs")}
              style={styles.errorBtn}
            >
              Browse Chefs
            </Button>
            <Button onPress={() => loadData()} style={styles.errorBtn}>
              Retry
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const initials = chef.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ListHeader = (
    <>
      {/* Back nav */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>

      {/* Chef header */}
      <View style={styles.chefHeader}>
        <FavoriteButton
          type="chef"
          id={chef.chefId}
          label={chef.name}
          style={styles.favoriteButton}
        />
        <View style={styles.chefHeaderTop}>
          <View style={styles.chefAvatarWrap}>
            {chef.image ? (
              <Image
                source={{ uri: chef.image }}
                style={styles.chefAvatar}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.chefAvatar, styles.chefAvatarFallback]}>
                <Text style={styles.chefAvatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={styles.chefInfo}>
            <View style={styles.chefNameRow}>
              <Text style={styles.chefName}>{chef.name}</Text>
              {chef.isVerified && (
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={colors.success}
                />
              )}
            </View>

            <Text style={styles.chefCuisine} numberOfLines={2}>
              {chef.cuisine}
            </Text>

            <View style={styles.chefBadgeRow}>
              {chef.rating > 0 ? (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={12} color={colors.accent} />
                  <Text style={styles.ratingPillText}>
                    {chef.rating.toFixed(1)}
                  </Text>
                  {reviews.length > 0 && (
                    <Text style={styles.ratingPillCount}>
                      · {reviews.length}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.ratingPill}>
                  <Ionicons name="star-outline" size={12} color={colors.mutedForeground} />
                  <Text style={styles.ratingPillCount}>New</Text>
                </View>
              )}
              {chef.isVeg && (
                <View style={styles.vegBadge}>
                  <Text style={styles.vegText}>🌿 Veg</Text>
                </View>
              )}
              {/* Open / offline status pill */}
              {status &&
                (status.is_open ? (
                  <View style={[styles.availBadge, styles.availBadgeOpen]}>
                    <View style={styles.availDot} />
                    <Text style={styles.availBadgeOpenText}>Open now</Text>
                  </View>
                ) : (
                  <View style={[styles.availBadge, styles.availBadgeOffline]}>
                    <Ionicons
                      name="moon-outline"
                      size={11}
                      color={colors.mutedForeground}
                    />
                    <Text style={styles.availBadgeOfflineText}>Offline</Text>
                  </View>
                ))}
            </View>

            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={colors.mutedForeground}
              />
              <Text style={styles.metaText} numberOfLines={1}>
                {chef.location}
              </Text>
            </View>
          </View>
        </View>

        {/* About — folded into the header section */}
        {!!chef.bio && (
          <View style={styles.aboutBlock}>
            <Text style={styles.aboutLabel}>About</Text>
            <Text style={styles.aboutText}>{chef.bio}</Text>
          </View>
        )}
      </View>

      {/* Offline banner */}
      {isChefOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="moon-outline" size={18} color={colors.mutedForeground} />
          <Text style={styles.offlineBannerText}>
            {status?.next_open_day_label && status?.next_open_time
              ? `This chef is currently offline. Opens ${status.next_open_day_label} at ${displayTime(status.next_open_time)}. Ordering is unavailable.`
              : "This chef is currently offline. Ordering is unavailable."}
          </Text>
        </View>
      )}

      {/* Specialties & dietary */}
      {(chef.specialties.length > 0 || chef.dietaryTags.length > 0) && (
        <View style={styles.card}>
          {chef.specialties.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Specialties</Text>
              <View style={styles.tagsWrap}>
                {chef.specialties.map((s) => (
                  <View key={s} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {chef.dietaryTags.length > 0 && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  chef.specialties.length > 0 && styles.sectionTitleSpaced,
                ]}
              >
                Dietary Options
              </Text>
              <View style={styles.tagsWrap}>
                {chef.dietaryTags.map((t) => (
                  <View key={t} style={[styles.tagChip, styles.tagChipOutline]}>
                    <Text style={styles.tagChipOutlineText}>{t}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Food safety */}
      {chef.foodSafetyBadges.length > 0 && (
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="shield-checkmark" size={15} color={colors.success} />
            <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
              Food Safety
            </Text>
          </View>
          <View style={styles.tagsWrap}>
            {chef.foodSafetyBadges.map((b) => (
              <View key={b} style={styles.safetyBadge}>
                <Text style={styles.safetyBadgeText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Weekly availability */}
      {slots.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Weekly Availability</Text>
          <View style={styles.hoursList}>
            {DAYS.map((label, i) => {
              const daySlots = slots.filter((s) => s.day_of_week === i);
              return (
                <View key={label} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{label}</Text>
                  {daySlots.length > 0 ? (
                    <Text style={styles.hoursValue}>
                      {daySlots
                        .map(
                          (s) =>
                            `${displayTime(s.open_time)} – ${displayTime(s.close_time)}`
                        )
                        .join(", ")}
                    </Text>
                  ) : (
                    <Text style={styles.hoursClosed}>Closed</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Reviews — preview first few, then link out to the full list.
          Shown above the menu so social proof leads into today's dishes. */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}
        </Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyReviews}>No reviews yet — be the first!</Text>
        ) : (
          <View>
            {reviews.slice(0, REVIEW_PREVIEW_COUNT).map((r, index, arr) => (
              <View
                key={r.id}
                style={[
                  styles.reviewItem,
                  index < arr.length - 1 && styles.reviewItemBorder,
                ]}
              >
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewLeft}>
                    <StarRow stars={r.stars} />
                    <Text style={styles.reviewerName}>
                      {r.customer_name ?? "Customer"}
                    </Text>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {!!r.comment && (
                  <Text style={styles.reviewComment}>{r.comment}</Text>
                )}
              </View>
            ))}

            {reviews.length > 1 && (
              <Pressable
                style={({ pressed }) => [
                  styles.viewAllReviews,
                  pressed && styles.viewAllReviewsPressed,
                ]}
                onPress={() => router.push(`/chef/${id}/reviews`)}
                accessibilityRole="button"
              >
                <Text style={styles.viewAllReviewsText}>
                  View all reviews ({reviews.length})
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Section heading + inline "request a custom dish" action */}
      <View style={styles.menuHeading}>
        <View style={styles.menuHeadingLeft}>
          <Text style={styles.menuTitle}>Today's Menu</Text>
          {menuItems.length > 0 && (
            <Text style={styles.menuCount}>{menuItems.length} items</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.requestBtn,
            pressed && styles.requestBtnPressed,
          ]}
          onPress={handleRequestFromChef}
          accessibilityRole="button"
          accessibilityLabel="Request custom dish from chef"
          hitSlop={6}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.requestBtnText}>Request dish</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📝"
            title="No menu items yet"
            description="This chef hasn't added any menu items yet. But you can request a custom dish!"
            actionLabel={`Request Custom Dish from ${chef.name}`}
            onAction={handleRequestFromChef}
          />
        }
      />
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backLabel: {
    ...typography.sm,
    color: colors.mutedForeground,
  },

  // Chef header
  chefHeader: {
    backgroundColor: colors.lightSage,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  chefHeaderTop: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  chefAvatarWrap: {
    ...shadow.md,
    borderRadius: radius.xl,
  },
  chefAvatar: {
    width: 92,
    height: 92,
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: colors.white,
  },
  chefAvatarFallback: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chefAvatarInitials: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.primary,
  },
  chefInfo: { flex: 1, gap: 6 },
  favoriteButton: { top: 10, right: 10 },
  chefNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    // Keeps a long kitchen name from running under the favorite heart, which is
    // absolutely positioned at the header's top-right.
    paddingRight: 30,
  },
  chefName: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  chefCuisine: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  chefBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingPillText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.foreground,
  },
  ratingPillCount: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  vegBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vegText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.successSubtleForeground,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  starRow: { flexDirection: "row", gap: 2 },

  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  availBadgeOpen: { backgroundColor: colors.secondaryStrong },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  availBadgeOpenText: { ...typography.xs, fontWeight: "700", color: colors.white },
  availBadgeOffline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availBadgeOfflineText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.mutedForeground,
  },

  // About (folded into header)
  aboutBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  aboutLabel: {
    ...typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  aboutText: {
    ...typography.sm,
    color: colors.foreground,
    lineHeight: 20,
  },

  // Offline banner
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  offlineBannerText: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 18,
  },

  // Info cards (about / specialties / safety / hours / reviews)
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    ...shadow.sm,
  },
  sectionTitle: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  sectionTitleSpaced: { marginTop: spacing.md },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: spacing.sm,
  },
  sectionTitleInline: { marginBottom: 0 },
  bioText: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },

  // Tags
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tagChip: {
    backgroundColor: colors.accentSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.accentSubtleForeground,
  },
  tagChipOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipOutlineText: {
    ...typography.xs,
    fontWeight: "500",
    color: colors.foreground,
  },

  // Safety badges
  safetyBadge: {
    backgroundColor: colors.successSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  safetyBadgeText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.successSubtleForeground,
  },

  // Weekly hours
  hoursList: { gap: 0 },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  hoursDay: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.foreground,
    width: 44,
  },
  hoursValue: {
    ...typography.sm,
    color: colors.foreground,
    flex: 1,
    textAlign: "right",
  },
  hoursClosed: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
    textAlign: "right",
  },

  // Reviews
  reviewItem: { paddingVertical: spacing.sm },
  reviewItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewerName: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.foreground,
  },
  reviewDate: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  reviewComment: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  emptyReviews: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  viewAllReviews: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  viewAllReviewsPressed: { opacity: 0.7 },
  viewAllReviewsText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.primary,
  },

  // Menu section
  menuHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  menuHeadingLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    flexShrink: 1,
  },
  menuTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  menuCount: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  requestBtnPressed: { opacity: 0.7 },
  requestBtnText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.primary,
  },

  listContent: {
    paddingBottom: spacing["2xl"],
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },


  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  errorBtn: { flex: 1 },
});
