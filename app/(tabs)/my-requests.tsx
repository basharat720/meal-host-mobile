import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { requestService } from "@/services/api";
import { FoodRequest } from "@/services/types";
import { colors, spacing, typography, radius, shadow } from "@/constants/theme";

function statusBadgeVariant(
  status: FoodRequest["status"]
): "success" | "default" {
  return status === "OPEN" ? "success" : "default";
}

export default function MyRequestsScreen() {
  const { dbUser, loading: authLoading } = useAuth();

  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [offerCounts, setOfferCounts] = useState<Map<number, number>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const hasMore = requests.length < total;

  const fetchData = useCallback(
    async (reset = true) => {
      if (!dbUser) return;
      if (reset) {
        setIsLoading(true);
        setFetchError(null);
      }
      try {
        const page = await requestService.getCustomerRequests(
          dbUser.id as number,
          0,
          20
        );
        const sorted = [...page.items].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRequests(sorted);
        setTotal(page.total);

        const results = await Promise.allSettled(
          sorted.map((r) => requestService.getRequestOffers(r.id))
        );
        const map = new Map<number, number>();
        results.forEach((result, i) => {
          map.set(
            sorted[i].id,
            result.status === "fulfilled" ? result.value.length : 0
          );
        });
        setOfferCounts(map);
      } catch {
        setFetchError("Couldn't load your requests. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [dbUser]
  );

  const loadMore = useCallback(async () => {
    if (!dbUser || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const page = await requestService.getCustomerRequests(
        dbUser.id as number,
        requests.length,
        20
      );
      const newItems = [...page.items].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests((prev) => [...prev, ...newItems]);
      setTotal(page.total);

      const results = await Promise.allSettled(
        newItems.map((r) => requestService.getRequestOffers(r.id))
      );
      setOfferCounts((prev) => {
        const next = new Map(prev);
        results.forEach((result, i) => {
          next.set(
            newItems[i].id,
            result.status === "fulfilled" ? result.value.length : 0
          );
        });
        return next;
      });
    } catch {
      // silently fail on load-more errors
    } finally {
      setIsLoadingMore(false);
    }
  }, [dbUser, requests.length, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  if (authLoading || (isLoading && !isRefreshing)) {
    return <FullScreenLoader message="Loading your requests..." />;
  }

  if (!dbUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="👤"
          title="Sign in required"
          description="Please sign in to view your food requests."
        />
      </SafeAreaView>
    );
  }

  if (fetchError && requests.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Requests</Text>
          <Button
            size="sm"
            onPress={() => router.push("/(tabs)/post-request")}
          >
            + Post Request
          </Button>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.destructive}
          />
          <Text style={styles.errorTitle}>Couldn't load your requests</Text>
          <Text style={styles.errorDesc}>
            Check your connection and try again.
          </Text>
          <Button onPress={() => fetchData()} style={styles.retryBtn}>
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: FoodRequest }) => {
    const offerCount = offerCounts.get(item.id) ?? 0;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.requestCard,
          pressed && styles.cardPressed,
        ]}
        onPress={() =>
          router.push({
            pathname: "/my-requests/[id]",
            params: { id: item.id.toString(), request: JSON.stringify(item) },
          })
        }
      >
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Badge
                label={item.status}
                variant={statusBadgeVariant(item.status)}
              />
            </View>

            <View style={styles.cardMeta}>
              {item.event_time && (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text style={styles.metaText}>
                    {new Date(item.event_time).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
              <Text style={styles.metaText}>
                {offerCount === 0
                  ? "No offers yet"
                  : `${offerCount} offer${offerCount > 1 ? "s" : ""}`}
              </Text>
            </View>

            {item.dietary_tags.length > 0 && (
              <View style={styles.tagsRow}>
                {item.dietary_tags.slice(0, 3).map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag.code}</Text>
                  </View>
                ))}
                {item.dietary_tags.length > 3 && (
                  <Text style={styles.metaText}>
                    +{item.dietary_tags.length - 3}
                  </Text>
                )}
              </View>
            )}

            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.mutedForeground}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Requests</Text>
          {total > 0 && (
            <Text style={styles.headerSubtitle}>
              {requests.length} of {total} request{total !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        <Button
          size="sm"
          onPress={() => router.push("/(tabs)/post-request")}
        >
          + Post Request
        </Button>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No requests yet"
            description="Post a food request and chefs will respond with offers."
            actionLabel="Post a Request"
            onAction={() => router.push("/(tabs)/post-request")}
          />
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadMoreText}>Loading more...</Text>
            </View>
          ) : hasMore ? null : requests.length > 0 ? (
            <Text style={styles.endText}>
              Showing all {total} request{total !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  listContent: {
    padding: spacing.md,
    paddingBottom: spacing["2xl"],
    flexGrow: 1,
  },

  requestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardPressed: { opacity: 0.8 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardLeft: { flex: 1 },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },

  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    ...typography.xs,
    color: colors.mutedForeground,
  },

  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tagText: {
    ...typography.xs,
    fontWeight: "600",
    color: colors.foreground,
  },

  cardDescription: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: 4,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    marginTop: spacing.md,
  },
  errorDesc: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  retryBtn: { minWidth: 120 },

  loadMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadMoreText: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  endText: {
    textAlign: "center",
    ...typography.sm,
    color: colors.mutedForeground,
    paddingVertical: spacing.lg,
  },
});
