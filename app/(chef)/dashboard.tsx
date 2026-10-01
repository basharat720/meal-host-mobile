import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { chefService, ChefDashboardStats } from "@/services/chefService";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NotificationBell } from "@/components/NotificationBell";
import { isChefActive, getActivationBlockers } from "@/lib/chefStatus";
import { chefDisplayName } from "@/lib/chefName";
import { ChefReviewsModal, StarRow } from "@/components/ChefReviewsModal";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

interface StatCardProps {
  label: string;
  value: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  loading: boolean;
}

const StatCard = ({ label, value, icon, loading }: StatCardProps) => (
  <View style={styles.statCard}>
    <View style={styles.statIconWrap}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    {loading || value === null ? (
      <View style={styles.statSkeleton} />
    ) : (
      <Text style={styles.statValue}>{value}</Text>
    )}
  </View>
);

export default function DashboardScreen() {
  const { dbUser } = useAuth();
  const { formatPrice } = useI18n();
  const [stats, setStats] = useState<ChefDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chefService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await chefService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to refresh stats:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const profilePictureUrl = dbUser?.chef_profile?.profile_picture_url ?? null;
  // The chef's own portal is branded with their kitchen, not their personal name.
  const chefName = chefDisplayName(dbUser, "My Kitchen");

  const accountActive = isChefActive(dbUser);
  const activationBlockers = getActivationBlockers(dbUser);

  // The two figures share one card, which doubles as the way into Earnings &
  // Orders where the same numbers can be seen over any range. The rating moved
  // into the header pill.
  const todaysStats: { label: string; value: string | null; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      label: "Today's Orders",
      value: stats ? String(stats.todays_orders ?? 0) : null,
      icon: "bag-handle-outline",
    },
    {
      label: "Today's Earnings",
      value: stats ? formatPrice(stats.todays_earnings ?? 0) : null,
      icon: "cash-outline",
    },
  ];

  const reviewCount = stats?.review_count ?? 0;
  const ratingAverage = stats?.rating ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {chefName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title}>Chef Dashboard</Text>
            <Text style={styles.subtitle}>Welcome back, {chefName}</Text>
            {loading || !stats ? (
              <View style={styles.ratingSkeleton} />
            ) : reviewCount > 0 ? (
              <Pressable
                style={styles.ratingPill}
                onPress={() => setReviewsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="View your reviews"
              >
                <StarRow stars={Math.round(ratingAverage)} size={12} />
                <Text style={styles.ratingValue}>{ratingAverage.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>
                  ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
                </Text>
              </Pressable>
            ) : (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingCount}>No reviews yet</Text>
              </View>
            )}
          </View>
          {/* The chef header sits on the pale-blue wash, where the brand
              orange is 2.95:1 — under the 3:1 non-text floor. The darkened
              orange clears it at 4.05:1. */}
          <NotificationBell color={colors.secondaryStrong} />
        </View>

        {/* Inactive-account banner */}
        {!accountActive && (
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={colors.destructive}
              />
              <Text style={styles.bannerTitle}>Account Inactive</Text>
            </View>
            {activationBlockers.length > 0 ? (
              <>
                <Text style={styles.bannerText}>
                  You can&apos;t add menu items or accept orders yet. To activate
                  your account:
                </Text>
                <View style={styles.bannerList}>
                  {activationBlockers.map((blocker) => (
                    <View key={blocker} style={styles.bannerListItem}>
                      <Text style={styles.bannerBullet}>{"•"}</Text>
                      <Text style={styles.bannerText}>{blocker}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.bannerText}>
                Your chef account is currently inactive or pending approval. You
                cannot add menu items or accept orders until your account is
                approved.
              </Text>
            )}
          </View>
        )}

        {/* Today, and the way into Earnings & Orders */}
        <Pressable
          style={({ pressed }) => [styles.todayCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/(chef)/earnings" as any)}
          accessibilityRole="button"
          accessibilityLabel="View earnings and orders"
        >
          <View style={styles.todayRow}>
            {todaysStats.map((card, index) => (
              <React.Fragment key={card.label}>
                {index > 0 && <View style={styles.todayDivider} />}
                <StatCard
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  loading={loading}
                />
              </React.Fragment>
            ))}
          </View>
          <View style={styles.todayFooter}>
            <Text style={styles.todayFooterText}>View earnings & orders</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>

        {/* Kept as its own card rather than dropped with web's restructure:
            web was showing a client-side estimate, but /chefs/dashboard/stats
            really does count distinct customers with a completed order. */}
        <View style={styles.soloCard}>
          <StatCard
            label="Happy Customers"
            value={stats ? String(stats.happy_customers ?? 0) : null}
            icon="people-outline"
            loading={loading}
          />
        </View>

        {/* Quick actions */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/(chef)/availability")}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Availability & Prep Time</Text>
            <Text style={styles.actionSubtitle}>
              Set your weekly opening hours and default prep time
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>

      <ChefReviewsModal
        chefId={dbUser?.id ?? null}
        visible={reviewsOpen}
        onClose={() => setReviewsOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.lightSage,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  headerText: { flex: 1 },
  title: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  banner: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bannerTitle: {
    ...typography.base,
    fontWeight: "700",
    color: colors.destructive,
  },
  bannerText: {
    ...typography.sm,
    color: colors.foreground,
    flexShrink: 1,
  },
  bannerList: {
    gap: 4,
  },
  bannerListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bannerBullet: {
    ...typography.sm,
    color: colors.foreground,
  },

  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingValue: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.foreground,
  },
  ratingCount: { ...typography.xs, color: colors.mutedForeground },
  ratingSkeleton: {
    width: 128,
    height: 22,
    marginTop: 4,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },

  todayCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: "hidden",
    ...shadow.sm,
  },
  todayRow: { flexDirection: "row" },
  soloCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: "hidden",
    ...shadow.sm,
  },
  todayDivider: { width: 1, backgroundColor: colors.border },
  todayFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  todayFooterText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.primary,
  },

  // A pane inside todayCard, not a card of its own — no border or shadow.
  statCard: {
    flex: 1,
    padding: spacing.md,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.lightSage,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  statSkeleton: {
    height: 32,
    width: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.lightSage,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1 },
  actionTitle: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
  },
  actionSubtitle: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
