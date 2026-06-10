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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { orderService } from "@/services/orderService";
import { Order } from "@/services/types";
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
  return min === max ? `~${min} min` : `${min}–${max} min`;
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
  updatingId: number | null;
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onUpdateStatus,
  onConfirmWithEta,
  updatingId,
}: OrderCardProps) {
  const badge = STATUS_BADGE[order.status];
  const isUpdating = updatingId === order.id;

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
      : null;

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
          <Text style={styles.orderTotal}>${order.total_amount.toFixed(2)}</Text>
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

          {nextAction && (
            <Button
              onPress={handleActionPress}
              loading={isUpdating}
              size="sm"
              style={styles.actionBtn}
            >
              {nextAction.label}
            </Button>
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

  const handleUpdateStatus = async (orderId: number, status: Order["status"], etaMinutes?: number) => {
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

  const toggleExpand = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id));

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
            onConfirmWithEta={(order) => setEtaDialogOrder(order)}
            updatingId={updatingId}
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
  actionBtn: { marginTop: 4 },

  loadMore: { margin: spacing.md },
});
