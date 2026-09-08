import React, { useState, useCallback, useRef } from "react";
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
import { router, useFocusEffect } from "expo-router";
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

type FilterType = "all" | "OPEN" | "CLOSED";

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
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const hasLoadedRef = useRef(false);

  const hasMore = requests.length < total;

  // This screen is a hidden tab route, so it can be pushed from several places
  // (the home CTA, the Profile tab, a push notification). Fall back to the feed
  // when there's nothing on the stack to return to.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }, []);

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

  // Refetch on every focus so the list reflects the latest requests/offers.
  // First focus shows the full loader; later focuses refetch silently (reset=false
  // keeps the current list visible without flashing the loader).
  useFocusEffect(
    useCallback(() => {
      fetchData(!hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
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
          actionLabel="Sign In"
          onAction={() =>
            router.push({
              pathname: "/(auth)/customer-login",
              params: { redirect: "/(tabs)/my-requests" },
            })
          }
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

  const openCount = requests.filter((r) => r.status === "OPEN").length;
  const closedCount = requests.filter((r) => r.status === "CLOSED").length;
  const totalOffers = Array.from(offerCounts.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const filteredRequests = requests.filter((r) =>
    activeFilter === "all" ? true : r.status === activeFilter
  );

  const stats: {
    key: string;
    label: string;
    value: number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    {
      key: "total",
      label: "Total",
      value: requests.length,
      icon: "documents-outline",
      color: colors.mutedForeground,
    },
    {
      key: "open",
      label: "Open",
      value: openCount,
      icon: "trending-up-outline",
      color: colors.success,
    },
    {
      key: "closed",
      label: "Closed",
      value: closedCount,
      icon: "checkmark-done-outline",
      color: colors.mutedForeground,
    },
    {
      key: "offers",
      label: "Offers",
      value: totalOffers,
      icon: "restaurant-outline",
      color: colors.accent,
    },
  ];

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: requests.length },
    { key: "OPEN", label: "Open", count: openCount },
    { key: "CLOSED", label: "Closed", count: closedCount },
  ];

  const listHeader =
    requests.length > 0 ? (
      <View style={styles.headerBlock}>
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.key} style={styles.statCard}>
              <View style={styles.statLabelRow}>
                <Ionicons name={stat.icon} size={13} color={stat.color} />
                <Text style={[styles.statLabel, { color: stat.color }]}>
                  {stat.label}
                </Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabsRow}>
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label} ({tab.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ) : null;

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
        <View style={styles.headerLeft}>
          <Pressable style={styles.backBtn} onPress={goBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>My Requests</Text>
            {total > 0 && (
              <Text style={styles.headerSubtitle}>
                {requests.length} of {total} request{total !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </View>
        <Button
          size="sm"
          onPress={() => router.push("/(tabs)/post-request")}
        >
          + Post Request
        </Button>
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
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
          requests.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No requests yet"
              description="Post a food request and chefs will respond with offers."
              actionLabel="Post a Request"
              onAction={() => router.push("/(tabs)/post-request")}
            />
          ) : (
            <View style={styles.filteredEmpty}>
              <Text style={styles.filteredEmptyText}>
                No {activeFilter === "OPEN" ? "open" : "closed"} requests.
              </Text>
            </View>
          )
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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

  headerBlock: {
    marginBottom: spacing.md,
  },

  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...shadow.sm,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  statLabel: {
    ...typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    ...typography.xl,
    fontWeight: "800",
    color: colors.foreground,
  },

  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },

  filteredEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  filteredEmptyText: {
    ...typography.base,
    color: colors.mutedForeground,
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
