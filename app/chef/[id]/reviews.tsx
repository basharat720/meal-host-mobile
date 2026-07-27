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
import { Ionicons } from "@expo/vector-icons";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { chefService, reviewService } from "@/services/api";
import { Chef, Review } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

function StarRow({ stars, size = 12 }: { stars: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= stars ? "star" : "star-outline"}
          size={size}
          color={n <= stars ? colors.warning : colors.border}
        />
      ))}
    </View>
  );
}

export default function ChefReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [chef, setChef] = useState<Chef | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setIsLoading(true);
      setFetchError(null);
    }
    try {
      const [chefRes, reviewsRes] = await Promise.allSettled([
        chefService.getChef(id),
        reviewService.getChefReviews(Number(id)),
      ]);
      setChef(chefRes.status === "fulfilled" ? chefRes.value : null);
      if (reviewsRes.status === "fulfilled") {
        setReviews(reviewsRes.value);
      } else if (!silent) {
        setFetchError("We couldn't load reviews right now.");
      }
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (isLoading) {
    return <FullScreenLoader message="Loading reviews..." />;
  }

  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
      : chef?.chef_profile?.rating_avg ?? 0;

  const Header = (
    <View style={styles.summaryCard}>
      <View style={styles.summaryLeft}>
        <Text style={styles.summaryAvg}>{avg.toFixed(1)}</Text>
        <StarRow stars={Math.round(avg)} size={14} />
        <Text style={styles.summaryCount}>
          {reviews.length} review{reviews.length !== 1 ? "s" : ""}
        </Text>
      </View>
      {!!chef?.name && (
        <View style={styles.summaryRight}>
          <Text style={styles.summaryChefLabel}>Reviews for</Text>
          <Text style={styles.summaryChefName} numberOfLines={2}>
            {chef.name}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
        <Text style={styles.title}>Reviews</Text>
        <View style={styles.backBtnSpacer} />
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={reviews.length > 0 ? Header : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewLeft}>
                <StarRow stars={item.stars} />
                <Text style={styles.reviewerName}>
                  {item.customer_name ?? "Customer"}
                </Text>
              </View>
              <Text style={styles.reviewDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            {!!item.comment && (
              <Text style={styles.reviewComment}>{item.comment}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={fetchError ? "⚠️" : "⭐"}
            title={fetchError ? "Couldn't load reviews" : "No reviews yet"}
            description={
              fetchError
                ? "Please check your connection and try again."
                : "This chef hasn't received any reviews yet."
            }
            actionLabel={fetchError ? "Retry" : undefined}
            onAction={fetchError ? () => load() : undefined}
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
    justifyContent: "space-between",
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
    minWidth: 72,
  },
  backBtnSpacer: { minWidth: 72 },
  backLabel: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  title: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },

  listContent: {
    padding: spacing.md,
    paddingBottom: spacing["2xl"],
    gap: spacing.sm,
    flexGrow: 1,
  },

  // Summary
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lightSage,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  summaryLeft: { alignItems: "flex-start", gap: 4 },
  summaryAvg: {
    ...typography["3xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  summaryCount: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  summaryRight: { alignItems: "flex-end", flex: 1, marginLeft: spacing.md },
  summaryChefLabel: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  summaryChefName: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "right",
  },

  // Review card
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
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
    lineHeight: 19,
  },
  starRow: { flexDirection: "row", gap: 2 },
});
