import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import {
  chefService,
  ChefEarningsOrder,
  ChefEarningsSummary,
} from "@/services/chefService";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";
import { orderStatusTone } from "@/lib/orderStatus";
import type { Order } from "@/services/types";
import { toTitleCase } from "@/lib/titleCase";

const PAGE_SIZE = 20;

/** Preset ranges, worked out from the chef's own calendar. */
type RangeKey = "today" | "last7" | "last30" | "thisMonth" | "lastMonth" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "all", label: "All time" },
];

const toIsoDate = (value: Date): string => {
  // Local calendar date, not UTC — toISOString() would shift the day for
  // anyone east or west of Greenwich.
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
};

const shiftDays = (days: number): Date => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value;
};

/** Resolve a preset into the inclusive from/to dates it stands for. */
const resolvePreset = (key: RangeKey): { from: string; to: string } | null => {
  const today = new Date();
  switch (key) {
    case "today":
      return { from: toIsoDate(today), to: toIsoDate(today) };
    case "last7":
      return { from: toIsoDate(shiftDays(-6)), to: toIsoDate(today) };
    case "last30":
      return { from: toIsoDate(shiftDays(-29)), to: toIsoDate(today) };
    case "thisMonth":
      return {
        from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: toIsoDate(today),
      };
    case "lastMonth":
      return {
        from: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "all":
    default:
      return null;
  }
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED: "Delivered",
  RECEIVED: "Received",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// CONFIRMED used to render on brand blue here, which made a status badge look
// like a button. Statuses now come from the shared order-status scale.
const statusStyle = (status: Order["status"] | string) => {
  const t = colors.status[orderStatusTone(status)];
  return { bg: t.bg, fg: t.fg, border: t.border };
};

const EMPTY_SUMMARY: ChefEarningsSummary = {
  total_orders: 0,
  earning_orders: 0,
  cancelled_orders: 0,
  gross_sales: 0,
  platform_fees: 0,
  processor_fees: 0,
  total_earnings: 0,
  average_order_value: 0,
};

export default function ChefEarningsScreen() {
  const { formatPrice } = useI18n();

  const [rangeKey, setRangeKey] = useState<RangeKey>("last30");
  const [summary, setSummary] = useState<ChefEarningsSummary>(EMPTY_SUMMARY);
  const [orders, setOrders] = useState<ChefEarningsOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const activeRange = useMemo(() => resolvePreset(rangeKey), [rangeKey]);

  const fetchPage = useCallback(
    (skip: number) =>
      chefService.getEarnings({
        start_date: activeRange?.from,
        end_date: activeRange?.to,
        skip,
        limit: PAGE_SIZE,
      }),
    [activeRange]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setExpandedOrderId(null);
    fetchPage(0)
      .then((data) => {
        if (cancelled) return;
        setSummary(data.summary);
        setOrders(data.orders);
        setTotal(data.total);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load your earnings. Please try again.");
        setSummary(EMPTY_SUMMARY);
        setOrders([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const data = await fetchPage(orders.length);
      setOrders((current) => [...current, ...data.orders]);
      setTotal(data.total);
    } catch {
      setError("Couldn't load more orders. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const rangeCaption = () => {
    if (!activeRange) return "All time";
    const from = new Date(activeRange.from).toLocaleDateString();
    if (activeRange.from === activeRange.to) return from;
    return `${from} – ${new Date(activeRange.to).toLocaleDateString()}`;
  };

  const summaryTiles: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; emphasis?: boolean }[] = [
    {
      icon: "trending-up-outline",
      label: "Total earnings",
      value: formatPrice(summary.total_earnings),
      emphasis: true,
    },
    { icon: "cash-outline", label: "Gross sales", value: formatPrice(summary.gross_sales) },
    {
      icon: "receipt-outline",
      label: "Fees",
      value: formatPrice(summary.platform_fees + summary.processor_fees),
    },
    {
      icon: "bag-handle-outline",
      label: "Orders counted",
      value: String(summary.earning_orders),
    },
    {
      icon: "stats-chart-outline",
      label: "Average order",
      value: formatPrice(summary.average_order_value),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(chef)/dashboard"))}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Earnings & Orders</Text>
          <Text style={styles.headerSubtitle}>{rangeCaption()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date range presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeRow}
        >
          {RANGE_OPTIONS.map((option) => {
            const active = rangeKey === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
                onPress={() => setRangeKey(option.key)}
              >
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="outline" onPress={() => setRangeKey(rangeKey)}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryGrid}>
              {summaryTiles.map((tile) => (
                <View
                  key={tile.label}
                  style={[styles.summaryTile, tile.emphasis && styles.summaryTileEmphasis]}
                >
                  <View style={styles.summaryTileHeader}>
                    <Ionicons
                      name={tile.icon}
                      size={14}
                      color={tile.emphasis ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={styles.summaryLabel}>{tile.label}</Text>
                  </View>
                  <Text style={[styles.summaryValue, tile.emphasis && styles.summaryValueEmphasis]}>
                    {tile.value}
                  </Text>
                </View>
              ))}
            </View>

            {summary.cancelled_orders > 0 && (
              <Text style={styles.cancelledNote}>
                {summary.cancelled_orders} cancelled order
                {summary.cancelled_orders !== 1 ? "s" : ""} in this range, not counted above.
              </Text>
            )}

            {/* Orders */}
            <Text style={styles.sectionTitle}>
              Orders{total > 0 ? ` (${total})` : ""}
            </Text>

            {orders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="bag-outline" size={28} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No orders in this range.</Text>
              </View>
            ) : (
              orders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const isCancelled = order.status === "CANCELLED";
                const badge = statusStyle(order.status);
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <Pressable
                      style={styles.orderHeader}
                      onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <View style={styles.orderMain}>
                        <View style={styles.orderTopRow}>
                          <Text style={styles.orderId}>#{order.id}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderWidth: 1, borderColor: badge.border }]}>
                            <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                              {STATUS_LABELS[order.status] ?? order.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.orderDate}>
                          {new Date(order.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Text>
                        <Text style={styles.orderItem} numberOfLines={1}>
                          {toTitleCase(order.item_title) || "Dish unavailable"}
                          {order.quantity > 1 ? ` × ${order.quantity}` : ""}
                        </Text>
                        <Text style={styles.orderCustomer} numberOfLines={1}>
                          {order.customer_name ?? "Customer"}
                          {order.payment_method
                            ? ` · ${order.payment_method === "card" ? "Paid by card" : "Paid by cash"}`
                            : ""}
                        </Text>
                      </View>

                      <View style={styles.orderMoney}>
                        <Text style={styles.moneyLabel}>Customer paid</Text>
                        <Text style={[styles.moneyValue, isCancelled && styles.struck]}>
                          {formatPrice(order.total_amount)}
                        </Text>
                        <Text style={[styles.moneyLabel, { marginTop: 6 }]}>You earn</Text>
                        <Text
                          style={[
                            styles.moneyEarned,
                            isCancelled && styles.struck,
                          ]}
                        >
                          {order.chef_earnings === null ? "—" : formatPrice(order.chef_earnings)}
                        </Text>
                      </View>

                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </Pressable>

                    {isExpanded && (
                      <View style={styles.orderDetail}>
                        <Text style={styles.detailLine}>
                          <Text style={styles.detailLabel}>Type: </Text>
                          {order.delivery_type}
                        </Text>

                        {!!order.delivery_phone && (
                          <View style={styles.detailRow}>
                            <Ionicons name="call-outline" size={13} color={colors.mutedForeground} />
                            <Text style={styles.detailLine}>{order.delivery_phone}</Text>
                          </View>
                        )}

                        {!!order.delivery_address && (
                          <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                            <Text style={styles.detailLine}>{order.delivery_address}</Text>
                          </View>
                        )}

                        {!!order.special_instructions && (
                          <View style={styles.detailRow}>
                            <Ionicons name="chatbubble-outline" size={13} color={colors.mutedForeground} />
                            <Text style={styles.detailLine}>{order.special_instructions}</Text>
                          </View>
                        )}

                        {!!order.cancellation_reason && (
                          <Text style={styles.cancellationReason}>
                            Cancelled: {order.cancellation_reason}
                          </Text>
                        )}

                        {order.counts_towards_earnings ? (
                          <View style={styles.breakdown}>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownLabel}>Customer paid</Text>
                              <Text style={styles.breakdownValue}>
                                {formatPrice(order.total_amount)}
                              </Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownLabel}>Fees</Text>
                              <Text style={styles.breakdownValue}>
                                −{formatPrice((order.platform_fee ?? 0) + (order.processor_fee ?? 0))}
                              </Text>
                            </View>
                            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                              <Text style={styles.breakdownTotalLabel}>You earn</Text>
                              <Text style={styles.breakdownTotalValue}>
                                {formatPrice(order.chef_earnings ?? 0)}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.notEarnedNote}>
                            {isCancelled
                              ? "Cancelled orders don't count towards earnings."
                              : "Counts towards earnings once the order is delivered."}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {orders.length < total && (
              <Button
                variant="outline"
                onPress={loadMore}
                loading={isLoadingMore}
                style={styles.loadMore}
              >
                Load more
              </Button>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 32, justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  headerSubtitle: { ...typography.xs, color: colors.mutedForeground },

  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },
  centered: { paddingVertical: spacing["2xl"], alignItems: "center", gap: spacing.md },
  errorText: { ...typography.base, color: colors.destructive, textAlign: "center" },

  rangeRow: { gap: spacing.xs, paddingRight: spacing.md },
  rangeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeChipText: { ...typography.sm, color: colors.foreground },
  rangeChipTextActive: { color: colors.primaryForeground, fontWeight: "600" },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryTile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    ...shadow.sm,
  },
  summaryTileEmphasis: { flexBasis: "100%", borderColor: colors.primary },
  summaryTileHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  summaryValue: {
    ...typography.xl,
    fontFamily: fonts.display,
    fontWeight: "700",
    color: colors.foreground,
  },
  summaryValueEmphasis: { ...typography["2xl"], color: colors.primary },
  cancelledNote: { ...typography.xs, color: colors.mutedForeground },

  sectionTitle: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.xs,
  },

  emptyBox: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  emptyText: { ...typography.base, color: colors.mutedForeground },

  orderCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
  },
  orderMain: { flex: 1, gap: 2 },
  orderTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  orderId: {
    ...typography.sm,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "700" },
  orderDate: { ...typography.xs, color: colors.mutedForeground },
  orderItem: { ...typography.sm, color: colors.foreground },
  orderCustomer: { ...typography.xs, color: colors.mutedForeground },

  orderMoney: { alignItems: "flex-end" },
  moneyLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  moneyValue: { ...typography.sm, color: colors.foreground },
  moneyEarned: {
    ...typography.base,
    fontWeight: "700",
    color: colors.primary,
  },
  struck: { textDecorationLine: "line-through", color: colors.mutedForeground },

  orderDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  detailLine: { ...typography.sm, color: colors.foreground, flex: 1 },
  detailLabel: { color: colors.mutedForeground },
  cancellationReason: { ...typography.sm, color: colors.destructive },

  breakdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: 4,
    marginTop: spacing.xs,
  },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { ...typography.sm, color: colors.mutedForeground },
  breakdownValue: { ...typography.sm, color: colors.foreground },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
    marginTop: 2,
  },
  breakdownTotalLabel: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.foreground,
  },
  breakdownTotalValue: { ...typography.sm, fontWeight: "700", color: colors.primary },
  notEarnedNote: { ...typography.sm, color: colors.mutedForeground },

  loadMore: { marginTop: spacing.sm },
});
