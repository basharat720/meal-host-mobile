import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { chefService, reviewService, availabilityService } from "@/services/api";
import { Chef, Review, AvailabilitySlot, ChefAvailabilityStatus } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "HH:MM" (24h) -> "9:00 AM" (12h) for display.
function displayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 0;
  const min = Number.isFinite(m) ? m : 0;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

function StarRow({ stars, size = "sm" }: { stars: number; size?: "sm" | "lg" }) {
  const iconSize = size === "lg" ? 16 : 12;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= stars ? "star" : "star-outline"}
          size={iconSize}
          color={n <= stars ? colors.warning : colors.border}
        />
      ))}
    </View>
  );
}

export default function ChefProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [chef, setChef] = useState<Chef | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<ChefAvailabilityStatus | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    // Keep showing the profile while refetching silently (refocus / pull-to-refresh).
    if (!silent) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      const [chefRes, reviewsRes, statusRes, slotsRes] = await Promise.allSettled([
        chefService.getChef(id),
        reviewService.getChefReviews(Number(id)),
        availabilityService.getStatus(id),
        availabilityService.getAvailability(Number(id)),
      ]);

      if (chefRes.status === "rejected") {
        if (!silent) setFetchError("Chef not found.");
        return;
      }
      setChef(chefRes.value);
      setReviews(reviewsRes.status === "fulfilled" ? reviewsRes.value : []);
      setStatus(statusRes.status === "fulfilled" ? statusRes.value : null);
      setSlots(slotsRes.status === "fulfilled" ? slotsRes.value : []);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Refetch when the screen regains focus (e.g. returning from the menu screen).
  useFocusEffect(
    useCallback(() => {
      load(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (isLoading) {
    return <FullScreenLoader message="Loading chef profile..." />;
  }

  if (fetchError || !chef) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.errorTitle}>{fetchError ?? "Chef not found"}</Text>
          <View style={styles.errorActions}>
            <Button
              variant="outline"
              onPress={() => router.push("/(tabs)/chefs")}
              style={styles.errorBtn}
            >
              Browse Chefs
            </Button>
            <Button onPress={() => load()} style={styles.errorBtn}>
              Retry
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const profile = chef.chef_profile;
  const primaryLocation =
    chef.locations?.find((l) => l.is_primary) ?? chef.locations?.[0];
  const ratingAvg = profile?.rating_avg ?? 0;
  const profilePictureUrl = profile?.profile_picture_url;
  const initials = chef.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const specialties =
    profile?.specialties ?? chef.specialties ?? [];
  const dietaryTags =
    profile?.dietary_tags ?? chef.dietary_tags ?? [];
  const foodSafetyBadges = profile?.food_safety_badge ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Back button */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          <Text style={styles.backLabel}>All Chefs</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Chef header card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            <View style={styles.headerInfo}>
              <Text style={styles.chefName}>{chef.name}</Text>

              {primaryLocation?.address && (
                <View style={styles.locationRow}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={colors.mutedForeground}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {primaryLocation.address}
                  </Text>
                </View>
              )}

              <View style={styles.ratingRow}>
                {ratingAvg > 0 ? (
                  <>
                    <StarRow stars={Math.round(ratingAvg)} />
                    <Text style={styles.ratingNum}>{ratingAvg.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>
                      ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                    </Text>
                  </>
                ) : (
                  <Text style={styles.noReviews}>No reviews yet</Text>
                )}
              </View>

              {profile?.status === "active" && (
                <View style={styles.activeBadge}>
                  <Badge label="Active" variant="success" />
                </View>
              )}

              {status && (
                status.is_open ? (
                  <View style={[styles.availBadge, styles.availBadgeOpen]}>
                    <View style={styles.availDot} />
                    <Text style={styles.availBadgeOpenText}>Open now</Text>
                  </View>
                ) : (
                  <View style={[styles.availBadge, styles.availBadgeOffline]}>
                    <Ionicons name="moon-outline" size={11} color={colors.mutedForeground} />
                    <Text style={styles.availBadgeOfflineText}>
                      {status.next_open_day_label && status.next_open_time
                        ? `Offline · Opens ${status.next_open_day_label} ${displayTime(status.next_open_time)}`
                        : "Offline"}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>
        </View>

        {/* Weekly hours */}
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
                          .map((s) => `${displayTime(s.open_time)} – ${displayTime(s.close_time)}`)
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

        {/* Bio / Kitchen Description */}
        {!!profile?.kitchen_description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.kitchen_description}</Text>
          </View>
        )}

        {/* Specialties & Dietary Tags */}
        {(specialties.length > 0 || dietaryTags.length > 0) && (
          <View style={styles.card}>
            {specialties.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.sectionTitle}>Specialties</Text>
                <View style={styles.tagsWrap}>
                  {specialties.map((s) => (
                    <View key={s} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {dietaryTags.length > 0 && (
              <View style={[styles.tagSection, specialties.length > 0 && styles.tagSectionSpaced]}>
                <Text style={styles.sectionTitle}>Dietary Options</Text>
                <View style={styles.tagsWrap}>
                  {dietaryTags.map((t) => (
                    <View key={t} style={[styles.tagChip, styles.tagChipOutline]}>
                      <Text style={styles.tagChipOutlineText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Food Safety */}
        {foodSafetyBadges.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="shield-checkmark"
                size={15}
                color={colors.success}
              />
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
                Food Safety
              </Text>
            </View>
            <View style={styles.tagsWrap}>
              {foodSafetyBadges.map((b) => (
                <View key={b} style={styles.safetyBadge}>
                  <Text style={styles.safetyBadgeText}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyReviews}>
              No reviews yet — be the first!
            </Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((r, index) => (
                <View
                  key={r.id}
                  style={[
                    styles.reviewItem,
                    index < reviews.length - 1 && styles.reviewItemBorder,
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
            </View>
          )}
        </View>

        {/* View Menu CTA */}
        <Button
          size="lg"
          onPress={() => router.push(`/chef/${id}/menu`)}
          style={styles.menuButton}
        >
          Browse {chef.name.split(" ")[0]}'s Menu
        </Button>
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backLabel: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginLeft: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing["3xl"],
    gap: spacing.sm,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.sm,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarFallback: {
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.primary,
  },
  headerInfo: { flex: 1 },
  chefName: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 6,
  },
  locationText: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  starRow: { flexDirection: "row", gap: 2 },
  ratingNum: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.foreground,
  },
  reviewCount: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  noReviews: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  activeBadge: { marginTop: 6 },

  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  availBadgeOpen: { backgroundColor: colors.success },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  availBadgeOpenText: { ...typography.xs, fontWeight: "700", color: "#fff" },
  availBadgeOffline: { backgroundColor: colors.muted },
  availBadgeOfflineText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.mutedForeground,
  },

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

  // Sections
  sectionTitle: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
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
  tagSection: {},
  tagSectionSpaced: { marginTop: spacing.md },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tagChip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.primary,
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
    backgroundColor: "#DCFCE7",
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  safetyBadgeText: {
    ...typography.xs,
    fontWeight: "600",
    color: "#166534",
  },

  // Reviews
  reviewsList: { gap: 0 },
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

  // CTA
  menuButton: { marginTop: spacing.sm },

  // Error state
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  errorTitle: { ...typography.lg, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  errorActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  errorBtn: { flex: 1 },
});
