import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { orderService } from "@/services/orderService";
import { dishService } from "@/services/dishService";
import { Order } from "@/services/types";
import { isChefActive } from "@/lib/chefStatus";
import { formatDurationRange } from "@/lib/duration";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type FilterTab = "active" | "completed" | "cancelled" | "all";

const ACTIVE_STATUSES = new Set<Order["status"]>(["PENDING", "CONFIRMED", "READY_FOR_PICKUP"]);
const COMPLETED_STATUSES = new Set<Order["status"]>(["DELIVERED", "RECEIVED", "COMPLETED"]);

const STATUS_BADGE: Record<
  Order["status"],
  { label: string; variant: "default" | "warning" | "success" | "destructive" | "outline" }
> = {
  PENDING:          { label: "Pending",          variant: "warning" },
  CONFIRMED:        { label: "Confirmed",         variant: "default" },
  READY_FOR_PICKUP: { label: "Ready for Pickup",  variant: "success" },
  DELIVERED:        { label: "Delivered",         variant: "success" },
  RECEIVED:         { label: "Received",          variant: "success" },
  COMPLETED:        { label: "Completed",         variant: "outline" },
  CANCELLED:        { label: "Cancelled",         variant: "destructive" },
};

const STATUS_SORT: Record<Order["status"], number> = {
  PENDING: 6, CONFIRMED: 5, READY_FOR_PICKUP: 4, RECEIVED: 3, DELIVERED: 2, COMPLETED: 1, CANCELLED: 0,
};

// 6-step order progress timeline (matches web ChefDashboard).
const STATUS_STEPS: Order["status"][] = [
  "PENDING", "CONFIRMED", "READY_FOR_PICKUP", "DELIVERED", "RECEIVED", "COMPLETED",
];

const STEP_LABELS: Record<Order["status"], string> = {
  PENDING:          "Order Placed",
  CONFIRMED:        "Confirmed",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED:        "Delivered",
  RECEIVED:         "Customer Received",
  COMPLETED:        "Completed",
  CANCELLED:        "Cancelled",
};

// Resolved dish info for an order's food listing.
// undefined = not fetched yet, null = fetch attempted but unavailable.
type DishInfo = { title: string; image_url: string | null };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatConfirmedEta = (order: Order): string | null => {
  if (!order.confirmed_eta_at) return null;
  const d = new Date(order.confirmed_eta_at);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatTentativeEta = (order: Order): string | null => {
  if (order.tentative_eta_min_minutes == null) return null;
  const min = order.tentative_eta_min_minutes;
  const max = order.tentative_eta_max_minutes ?? min;
  return formatDurationRange(min, max);
};

// ---------------------------------------------------------------------------
// ETA Confirm Dialog
// ---------------------------------------------------------------------------
interface EtaDialogProps {
  order: Order;
  defaultPrepMinutes?: number;
  onConfirm: (orderId: number, minutes: number | undefined) => void;
  onCancel: () => void;
}

function EtaDialog({ order, defaultPrepMinutes, onConfirm, onCancel }: EtaDialogProps) {
  const [minutes, setMinutes] = useState(
    defaultPrepMinutes != null ? String(defaultPrepMinutes) : ""
  );

  const handleConfirm = () => {
    const parsed = minutes.trim() ? parseInt(minutes, 10) : undefined;
    if (parsed !== undefined && (isNaN(parsed) || parsed <= 0)) {
      Alert.alert("Invalid ETA", "Please enter a positive number of minutes.");
      return;
    }
    onConfirm(order.id, parsed);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={etaStyles.overlay}>
        <View style={etaStyles.sheet}>
          <View style={etaStyles.handle} />
          <Text style={etaStyles.title}>Confirm Order #{order.id}</Text>
          <Text style={etaStyles.subtitle}>
            How many minutes until this order is ready? (optional)
          </Text>
          <TextInput
            style={etaStyles.input}
            placeholder="e.g. 30"
            placeholderTextColor={colors.mutedForeground}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
          />
          <Text style={etaStyles.hint}>
            Leave blank to use the estimated time calculated automatically.
          </Text>
          <View style={etaStyles.buttons}>
            <Button variant="outline" size="md" style={{ flex: 1 }} onPress={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" size="md" style={{ flex: 1 }} onPress={handleConfirm}>
              Confirm Order
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const etaStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    alignSelf: "center",
    marginBottom: spacing.xs,
  },
  title: { ...typography.xl, fontWeight: "700", color: colors.foreground },
  subtitle: { ...typography.base, color: colors.mutedForeground },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    ...typography.lg,
    color: colors.foreground,
    backgroundColor: colors.background,
    textAlign: "center",
  },
  hint: { ...typography.xs, color: colors.mutedForeground, textAlign: "center" },
  buttons: { flexDirection: "row", gap: spacing.sm },
});

// ---------------------------------------------------------------------------
// Order Card
// ---------------------------------------------------------------------------
interface OrderCardProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: number, status: Order["status"]) => void;
  onConfirmWithEta: (order: Order) => void;
  onReject: (order: Order) => void;
  updatingId: number | null;
  dishInfo?: DishInfo | null;
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onUpdateStatus,
  onConfirmWithEta,
  onReject,
  updatingId,
  dishInfo,
}: OrderCardProps) {
  const { formatPrice } = useI18n();
  const badge = STATUS_BADGE[order.status];
  const isUpdating = updatingId === order.id;

  // Resolve a display title for the ordered item.
  const orderTitle =
    dishInfo?.title ||
    (order.food_listing_id != null
      ? `Dish #${order.food_listing_id}`
      : order.food_request_id != null
      ? `Food Request #${order.food_request_id}`
      : `Order #${order.id}`);
  const perUnitPrice =
    order.quantity > 0 ? order.total_amount / order.quantity : order.total_amount;
  const currentStepIndex =
    order.status === "CANCELLED" ? -1 : STATUS_STEPS.indexOf(order.status);

  const confirmedEta = formatConfirmedEta(order);
  const tentativeEta = formatTentativeEta(order);
  const showEtaInHeader = ACTIVE_STATUSES.has(order.status) && (confirmedEta != null || tentativeEta != null);

  const nextAction: { label: string; status: Order["status"] } | null =
    order.status === "PENDING"
      ? { label: "Confirm Order", status: "CONFIRMED" }
      : order.status === "CONFIRMED"
      ? { label: "Mark Ready", status: "READY_FOR_PICKUP" }
      : order.status === "READY_FOR_PICKUP"
      ? { label: "Mark Delivered", status: "DELIVERED" }
      : order.status === "RECEIVED"
      ? { label: "Complete Order", status: "COMPLETED" }
      : null;

  // Reject (PENDING) / cancel (CONFIRMED, READY_FOR_PICKUP) an order.
  const canReject =
    order.status === "PENDING" ||
    order.status === "CONFIRMED" ||
    order.status === "READY_FOR_PICKUP";
  const rejectLabel = order.status === "PENDING" ? "Reject" : "Cancel Order";

  const handleActionPress = () => {
    if (!nextAction) return;
    if (nextAction.status === "CONFIRMED") {
      onConfirmWithEta(order);
    } else {
      onUpdateStatus(order.id, nextAction.status);
    }
  };

  return (
    <View style={styles.card}>
      {/* Summary row */}
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderId}>Order #{order.id}</Text>
          <Text style={styles.customerName}>{order.customer_name ?? "Customer"}</Text>
          <Text style={styles.orderMeta}>
            {formatDate(order.created_at)} · {order.quantity} item{order.quantity !== 1 ? "s" : ""}
          </Text>
          {showEtaInHeader && (
            <View style={styles.etaRow}>
              <Ionicons
                name="time-outline"
                size={12}
                color={confirmedEta ? colors.primary : colors.mutedForeground}
              />
              <Text style={confirmedEta ? styles.etaConfirmed : styles.etaTentative}>
                {confirmedEta
                  ? `Ready by ${confirmedEta}`
                  : `Est. ${tentativeEta}`}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={styles.orderTotal}>{formatPrice(order.total_amount)}</Text>
          <Badge label={badge.label} variant={badge.variant} />
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </Pressable>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.cardBody}>
          <View style={styles.divider} />

          {/* Order Summary — dish image, title, quantity & per-unit price */}
          <View style={styles.sectionLabelRow}>
            <Ionicons name="receipt-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.sectionLabel}>Order Summary</Text>
          </View>
          <View style={styles.summaryBox}>
            <View style={styles.summaryThumb}>
              {dishInfo?.image_url ? (
                <Image
                  source={{ uri: dishInfo.image_url }}
                  style={styles.summaryThumbImg}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="fast-food-outline" size={20} color={colors.mutedForeground} />
              )}
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryTitle} numberOfLines={2}>{orderTitle}</Text>
              <Text style={styles.summaryQty}>
                {order.quantity} × {formatPrice(perUnitPrice)}
              </Text>
              <View style={styles.summaryTotalRow}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{formatPrice(order.total_amount)}</Text>
              </View>
            </View>
          </View>

          {/* ETA detail in expanded view */}
          {(confirmedEta || tentativeEta) && (
            <View style={styles.etaDetailBox}>
              <Ionicons name="timer-outline" size={14} color={colors.primary} />
              <Text style={styles.etaDetailText}>
                {confirmedEta
                  ? `Confirmed ready by ${confirmedEta}`
                  : `Tentative: ${tentativeEta}`}
              </Text>
            </View>
          )}

          {order.delivery_address ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.detailText}>{order.delivery_address}</Text>
            </View>
          ) : null}

          {(order.delivery_phone ?? order.customer_phone) ? (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.detailText}>{order.delivery_phone ?? order.customer_phone}</Text>
            </View>
          ) : null}

          {order.special_instructions ? (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.detailText}>{order.special_instructions}</Text>
            </View>
          ) : null}

          {order.status === "DELIVERED" && (
            <Text style={styles.waitingNote}>Waiting for customer to confirm receipt.</Text>
          )}

          {/* Order progress timeline */}
          <View style={styles.sectionLabelRow}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.sectionLabel}>Order Progress</Text>
          </View>
          <View style={styles.timeline}>
            <View style={styles.timelineSpine} />
            {STATUS_STEPS.map((step, i) => {
              const isPast = order.status !== "CANCELLED" && i < currentStepIndex;
              const isCurrent = order.status !== "CANCELLED" && i === currentStepIndex;
              return (
                <View key={step} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        isPast && styles.timelineDotPast,
                        isCurrent && styles.timelineDotCurrent,
                      ]}
                    >
                      {isPast && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      isPast && styles.timelineLabelPast,
                      isCurrent && styles.timelineLabelCurrent,
                    ]}
                  >
                    {STEP_LABELS[step]}
                  </Text>
                </View>
              );
            })}
            {order.status === "CANCELLED" && (
              <View style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, styles.timelineDotCancelled]}>
                    <Ionicons name="close" size={10} color={colors.destructive} />
                  </View>
                </View>
                <Text style={[styles.timelineLabel, styles.timelineLabelCancelled]}>
                  {STEP_LABELS.CANCELLED}
                </Text>
              </View>
            )}
          </View>

          {(nextAction || canReject) && (
            <View style={styles.actionRow}>
              {nextAction && (
                <Button
                  onPress={handleActionPress}
                  loading={isUpdating}
                  size="sm"
                  style={styles.actionBtnFlex}
                >
                  {nextAction.label}
                </Button>
              )}
              {canReject && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => onReject(order)}
                  disabled={isUpdating}
                  style={styles.actionBtnFlex}
                  textStyle={styles.rejectText}
                >
                  {rejectLabel}
                </Button>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

export default function ChefOrdersScreen() {
  const { dbUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("active");
  const [etaDialogOrder, setEtaDialogOrder] = useState<Order | null>(null);
  const [dishCache, setDishCache] = useState<Record<number, DishInfo | null>>({});
  const isMounted = useRef(true);

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!dbUser) return;
      if (!silent) setLoading(true);
      try {
        const result = await orderService.getChefOrders(dbUser.id, 0, PAGE_SIZE);
        const items = Array.isArray(result)
          ? (result as Order[])
          : (result as { items: Order[]; total: number }).items ?? [];
        const t = Array.isArray(result)
          ? items.length
          : (result as { items: Order[]; total: number }).total ?? items.length;
        if (!isMounted.current) return;
        setOrders(items);
        setTotal(t);
      } catch {
        // silently fail background poll
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dbUser]
  );

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      fetchOrders();
      const interval = setInterval(() => fetchOrders(true), 30_000);
      return () => {
        isMounted.current = false;
        clearInterval(interval);
      };
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(true);
  };

  const loadMore = async () => {
    if (!dbUser || loadingMore || orders.length >= total) return;
    setLoadingMore(true);
    try {
      const result = await orderService.getChefOrders(dbUser.id, orders.length, PAGE_SIZE);
      const items = Array.isArray(result)
        ? (result as Order[])
        : (result as { items: Order[]; total: number }).items ?? [];
      setOrders((prev) => [...prev, ...items]);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const chefActive = isChefActive(dbUser);

  const requireActive = (): boolean => {
    if (!chefActive) {
      Alert.alert(
        "Account inactive",
        "Your chef account is not active yet, so you can't manage orders. Please wait for approval or complete your setup."
      );
      return false;
    }
    return true;
  };

  const handleUpdateStatus = async (orderId: number, status: Order["status"], etaMinutes?: number) => {
    if (!requireActive()) return;
    setUpdatingId(orderId);
    try {
      const updated = await orderService.updateOrderStatus(orderId, status, etaMinutes);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEtaConfirm = (orderId: number, minutes: number | undefined) => {
    setEtaDialogOrder(null);
    handleUpdateStatus(orderId, "CONFIRMED", minutes);
  };

  const openEtaDialog = (order: Order) => {
    if (!requireActive()) return;
    setEtaDialogOrder(order);
  };

  const handleReject = (order: Order) => {
    if (!requireActive()) return;
    const isPending = order.status === "PENDING";
    Alert.alert(
      isPending ? `Reject Order #${order.id}?` : `Cancel Order #${order.id}?`,
      "The customer will be notified and any card payment refunded. This cannot be undone.",
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: isPending ? "Reject" : "Cancel Order",
          style: "destructive",
          onPress: () => handleUpdateStatus(order.id, "CANCELLED"),
        },
      ]
    );
  };

  const toggleExpand = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id));

  // Lazily resolve the ordered dish's title/image for the expanded card.
  useEffect(() => {
    if (expandedId == null) return;
    const order = orders.find((o) => o.id === expandedId);
    const listingId = order?.food_listing_id;
    if (listingId == null || dishCache[listingId] !== undefined) return;
    let cancelled = false;
    dishService
      .getDish(listingId)
      .then((dish) => {
        if (cancelled) return;
        const image =
          dish.images?.find((img) => img.is_primary)?.image_url ??
          dish.images?.[0]?.image_url ??
          null;
        setDishCache((prev) => ({ ...prev, [listingId]: { title: dish.title, image_url: image } }));
      })
      .catch(() => {
        if (!cancelled) setDishCache((prev) => ({ ...prev, [listingId]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId, orders, dishCache]);

  const filtered = [...orders]
    .sort((a, b) => STATUS_SORT[b.status] - STATUS_SORT[a.status])
    .filter((o) => {
      if (activeFilter === "active") return ACTIVE_STATUSES.has(o.status);
      if (activeFilter === "completed") return COMPLETED_STATUSES.has(o.status);
      if (activeFilter === "cancelled") return o.status === "CANCELLED";
      return true;
    });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "active",    label: "Active",    count: orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length },
    { key: "completed", label: "Done",      count: orders.filter((o) => COMPLETED_STATUSES.has(o.status)).length },
    { key: "cancelled", label: "Cancelled", count: orders.filter((o) => o.status === "CANCELLED").length },
    { key: "all",       label: "All",       count: orders.length },
  ];

  if (loading) return <LoadingSpinner message="Loading orders…" />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Orders</Text>
        <Pressable onPress={onRefresh} hitSlop={8} disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={22} color={colors.primary} />
          }
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActiveFilter(t.key)}
            style={[styles.tab, activeFilter === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeFilter === t.key && styles.tabTextActive]}>
              {t.label} ({t.count})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id.toString()}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            expanded={expandedId === item.id}
            onToggle={() => toggleExpand(item.id)}
            onUpdateStatus={handleUpdateStatus}
            onConfirmWithEta={openEtaDialog}
            onReject={handleReject}
            updatingId={updatingId}
            dishInfo={item.food_listing_id != null ? dishCache[item.food_listing_id] : undefined}
          />
        )}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState icon="📋" title="No orders" description="Orders will appear here." />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={
          orders.length < total ? (
            <Button
              variant="outline"
              onPress={loadMore}
              loading={loadingMore}
              style={styles.loadMore}
            >
              Load More
            </Button>
          ) : null
        }
      />

      {/* ETA Confirm Dialog */}
      {etaDialogOrder && (
        <EtaDialog
          order={etaDialogOrder}
          defaultPrepMinutes={dbUser?.chef_profile?.default_prep_time_minutes}
          onConfirm={handleEtaConfirm}
          onCancel={() => setEtaDialogOrder(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  screenTitle: { ...typography.xl, fontWeight: "700", color: colors.foreground },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.xs, fontWeight: "600", color: colors.mutedForeground },
  tabTextActive: { color: "#fff" },

  listContent: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: "center" },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderLeft: { flex: 1, gap: 3 },
  orderId: { ...typography.base, fontWeight: "700", color: colors.foreground },
  customerName: { ...typography.sm, color: colors.mutedForeground },
  orderMeta: { ...typography.xs, color: colors.mutedForeground },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  etaConfirmed: { ...typography.xs, fontWeight: "600", color: colors.primary },
  etaTentative: { ...typography.xs, color: colors.mutedForeground },
  cardHeaderRight: { alignItems: "flex-end", gap: 6 },
  orderTotal: { ...typography.base, fontWeight: "700", color: colors.primary },

  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 4 },

  // Section headers (Order Summary / Order Progress)
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  sectionLabel: {
    ...typography.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },

  // Order Summary block
  summaryBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  summaryThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  summaryThumbImg: { width: "100%", height: "100%" },
  summaryInfo: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  summaryQty: { ...typography.xs, color: colors.mutedForeground },
  summaryTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  summaryTotalLabel: { ...typography.xs, color: colors.mutedForeground },
  summaryTotalValue: { ...typography.sm, fontWeight: "700", color: colors.primary },

  // Order progress timeline
  timeline: { position: "relative", marginTop: 2 },
  timelineSpine: {
    position: "absolute",
    left: 9,
    top: 14,
    bottom: 14,
    width: 2,
    backgroundColor: colors.border,
  },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 5 },
  timelineRail: { width: 20, alignItems: "center" },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotPast: { backgroundColor: colors.success, borderColor: colors.success },
  timelineDotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  timelineDotCancelled: {
    backgroundColor: `${colors.destructive}1A`,
    borderColor: colors.destructive,
  },
  timelineLabel: { ...typography.xs, color: colors.mutedForeground },
  timelineLabelPast: { color: colors.success, fontWeight: "600" },
  timelineLabelCurrent: { color: colors.primary, fontWeight: "700" },
  timelineLabelCancelled: { color: colors.destructive, fontWeight: "600" },
  etaDetailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: `${colors.primary}0D`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
  },
  etaDetailText: { ...typography.sm, fontWeight: "600", color: colors.primary },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  detailText: { ...typography.sm, color: colors.foreground, flex: 1, flexWrap: "wrap" },
  waitingNote: { ...typography.xs, fontStyle: "italic", color: colors.mutedForeground },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  actionBtnFlex: { flex: 1 },
  rejectText: { color: colors.destructive },

  loadMore: { margin: spacing.md },
});
