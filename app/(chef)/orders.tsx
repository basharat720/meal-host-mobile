import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { orderService } from "@/services/orderService";
import { dishService } from "@/services/dishService";
import { requestService } from "@/services/requestService";
import { Order } from "@/services/types";
import { isChefActive } from "@/lib/chefStatus";
import { formatDuration, formatDurationRange } from "@/lib/duration";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { useChatUnread } from "@/hooks/useOrderChat";
import {
  getOrderItemKey,
  getOrderItemName,
  getOrderListingName,
} from "@/lib/listingVariants";

// ---------------------------------------------------------------------------
// Helpers — ported from meal-host-frontend `src/pages/ChefDashboard.tsx` so a
// chef's card reads the same in the app and on the website.
// ---------------------------------------------------------------------------

// Orders are grouped by what the chef has to do about them, not by raw status.
type OrderQueue = "action" | "waiting" | "history";

const ACTION_STATUSES = new Set<Order["status"]>([
  "PENDING",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "RECEIVED",
]);
const WAITING_STATUSES = new Set<Order["status"]>(["DELIVERED"]);

const queueFor = (status: Order["status"]): OrderQueue =>
  ACTION_STATUSES.has(status)
    ? "action"
    : WAITING_STATUSES.has(status)
      ? "waiting"
      : "history";

// "Needs action" leads with the most urgent stage, and within a stage the
// order that has waited longest, so an early order cannot be buried under
// newer ones (web feature-docs/06-chef-dashboard.md).
const ACTION_STAGE_RANK: Partial<Record<Order["status"], number>> = {
  PENDING: 0,
  CONFIRMED: 1,
  READY_FOR_PICKUP: 2,
  RECEIVED: 3,
};

const time = (iso: string) => new Date(iso).getTime();

const STATUS_STEPS: Order["status"][] = [
  "PENDING",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "RECEIVED",
  "COMPLETED",
];

// Short labels for the progress bar inside an opened card.
const CHEF_STEP_SHORT: Record<Order["status"], string> = {
  PENDING: "Placed",
  CONFIRMED: "Confirmed",
  READY_FOR_PICKUP: "Ready",
  DELIVERED: "Delivered",
  RECEIVED: "Received",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// A pickup order never goes "Delivered" the way a delivery order does, and a
// delivery order is never "Ready for Pickup". The order's own status stays.
const stepsForOrder = (order: Order): Order["status"][] => {
  const skipped: Order["status"] =
    order.delivery_type === "delivery" ? "READY_FOR_PICKUP" : "DELIVERED";
  return STATUS_STEPS.filter((step) => step !== skipped || step === order.status);
};

// Pal follows the order on the chef's cards too. Cancelled gets no mascot.
const CHEF_POSE: Partial<Record<Order["status"], MascotPose>> = {
  PENDING: "idle",
  CONFIRMED: "cooking",
  READY_FOR_PICKUP: "delivering",
  DELIVERED: "flying",
  RECEIVED: "celebrating",
  COMPLETED: "love",
};

type StripTone = keyof typeof colors.status;
const CHEF_STRIP_TONE: Record<Order["status"], StripTone> = {
  PENDING: "pending",
  CONFIRMED: "active",
  READY_FOR_PICKUP: "ready",
  DELIVERED: "ready",
  RECEIVED: "done",
  COMPLETED: "closed",
  CANCELLED: "cancelled",
};

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

const formatOrderAge = (createdAt: string): string => {
  const createdTime = time(createdAt);
  if (!Number.isFinite(createdTime)) return "Date unavailable";
  const minutes = Math.max(0, Math.floor((Date.now() - createdTime) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

// "in 35 min" before the committed time, "20 min overdue" after it.
const formatDueIn = (iso: string): string | null => {
  const due = time(iso);
  if (!Number.isFinite(due)) return null;
  const minutes = Math.round((due - Date.now()) / 60_000);
  const span = (m: number) => (m >= 60 ? formatDuration(m) : `${m} min`);
  if (minutes >= 1) return `in ${span(minutes)}`;
  if (minutes <= -1) return `${span(-minutes)} overdue`;
  return "due now";
};

// What the strip tells the chef the order needs, in plain words.
const chefStripCopy = (order: Order): { title: string; sub?: string } => {
  const isDelivery = order.delivery_type === "delivery";
  switch (order.status) {
    case "PENDING": {
      const quoted = formatTentativeEta(order);
      return {
        title: `New order — placed ${formatOrderAge(order.created_at).toLowerCase()}`,
        sub: quoted ? `Customer was quoted ${quoted}` : undefined,
      };
    }
    case "CONFIRMED": {
      const due = formatConfirmedEta(order);
      return due && order.confirmed_eta_at
        ? {
            title: `Cooking — due by ${due}`,
            sub: formatDueIn(order.confirmed_eta_at) ?? undefined,
          }
        : { title: "Cooking", sub: "Mark it ready once it's packed." };
    }
    case "READY_FOR_PICKUP":
      return isDelivery
        ? { title: "Packed and ready to hand over", sub: "Mark it delivered once it leaves." }
        : {
            title: "Ready — waiting for the customer to collect",
            sub: "Mark it delivered once handed over.",
          };
    case "DELIVERED":
      return { title: "Waiting for the customer to confirm receipt" };
    case "RECEIVED":
      return { title: "Customer confirmed receipt", sub: "Complete the order to close it out." };
    case "COMPLETED":
      return { title: "Order completed" };
    case "CANCELLED":
      return {
        title: "Order cancelled",
        sub: order.cancellation_reason ? `Reason: ${order.cancellation_reason}` : undefined,
      };
  }
};

const NEXT_ACTION: Partial<Record<Order["status"], { label: string; status: Order["status"] }>> = {
  PENDING: { label: "Confirm order", status: "CONFIRMED" },
  CONFIRMED: { label: "Mark ready", status: "READY_FOR_PICKUP" },
  READY_FOR_PICKUP: { label: "Mark delivered", status: "DELIVERED" },
  RECEIVED: { label: "Complete order", status: "COMPLETED" },
};

type DishInfo = { title: string; image_url: string | null };
type RequestInfo = { title: string; description?: string };

const orderItemNames = (
  order: Order,
  dish: DishInfo | undefined,
  request: RequestInfo | undefined,
): string[] => {
  if (order.items?.length) return order.items.map(getOrderItemName);
  const fallback =
    dish?.title ??
    request?.title ??
    (order.food_listing_id != null
      ? `Dish #${order.food_listing_id}`
      : order.food_request_id != null
        ? `Food Request #${order.food_request_id}`
        : `Order #${order.id}`);
  return [getOrderListingName(order, fallback)];
};

// ---------------------------------------------------------------------------
// Order Card
// ---------------------------------------------------------------------------
interface OrderCardProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: number, status: Order["status"]) => void;
  onConfirm: (order: Order) => void;
  onReject: (order: Order) => void;
  updatingId: number | null;
  dishInfo?: DishInfo;
  requestInfo?: RequestInfo;
  /** Live unread count for this order's chat, ahead of the orders payload. */
  unreadMessages: number;
  onOpenChat: (order: Order) => void;
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onUpdateStatus,
  onConfirm,
  onReject,
  updatingId,
  dishInfo,
  requestInfo,
  unreadMessages,
  onOpenChat,
}: OrderCardProps) {
  const { formatPrice } = useI18n();
  const isUpdating = updatingId === order.id;
  const isDelivery = order.delivery_type === "delivery";
  const isCancelled = order.status === "CANCELLED";

  const names = orderItemNames(order, dishInfo, requestInfo);
  const orderTitle = names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0];
  // The cooking list: every line on the order, or the single dish an older
  // order carries.
  const cookingList = order.items?.length
    ? order.items.map((item) => ({
        key: getOrderItemKey(item),
        quantity: item.quantity,
        name: getOrderItemName(item),
      }))
    : [{ key: "only", quantity: order.quantity, name: names[0] }];

  const strip = chefStripCopy(order);
  const pose = CHEF_POSE[order.status];
  const toneColors = colors.status[CHEF_STRIP_TONE[order.status]];
  const visibleSteps = stepsForOrder(order);
  const currentIndex = isCancelled ? -1 : visibleSteps.indexOf(order.status);

  const nextAction = NEXT_ACTION[order.status];
  const canCancel = order.status === "CONFIRMED" || order.status === "READY_FOR_PICKUP";

  const handleActionPress = () => {
    if (!nextAction) return;
    // Confirming is the one step that carries an estimate, so it opens a
    // prompt rather than firing the status change straight away.
    if (nextAction.status === "CONFIRMED") {
      onConfirm(order);
      return;
    }
    onUpdateStatus(order.id, nextAction.status);
  };

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      {/* ── Header: what to cook ── */}
      <Pressable
        onPress={onToggle}
        style={styles.cardHeader}
        android_ripple={{ color: colors.muted }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={[styles.thumb, isCancelled && { opacity: 0.6 }]}>
          {dishInfo?.image_url ? (
            <Image source={{ uri: dishInfo.image_url }} style={styles.thumbImg} contentFit="cover" />
          ) : (
            <Ionicons name="cube-outline" size={20} color={colors.mutedForeground} />
          )}
        </View>

        <View style={styles.headerMain}>
          <Text
            style={[styles.orderTitle, isCancelled && { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {orderTitle}
          </Text>
          <View style={styles.headerTags}>
            <View style={styles.idChip}>
              <Text style={styles.idChipText}>#{order.id}</Text>
            </View>
            <View style={styles.tag}>
              <Ionicons
                name={isDelivery ? "bicycle-outline" : "storefront-outline"}
                size={12}
                color={colors.foreground}
              />
              <Text style={styles.tagText}>{isDelivery ? "Delivery" : "Pickup"}</Text>
            </View>
          </View>
          <Text style={styles.cookingList}>
            {cookingList.map((line, i) => (
              <Text key={line.key}>
                {i > 0 ? "  ·  " : ""}
                <Text style={styles.bold}>{line.quantity} ×</Text> {line.name}
              </Text>
            ))}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.orderTotal, isCancelled && styles.struck]}>
            {formatPrice(order.total_amount)}
          </Text>
          {order.payment_method ? (
            <Text style={styles.payText}>
              {order.payment_method === "CASH" ? "Cash" : "Card"}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* ── Status strip: what the order needs ── */}
      <View style={[styles.strip, { backgroundColor: toneColors.bg }]}>
        {pose ? (
          <Mascot pose={pose} height={44} style={{ marginVertical: -4 }} />
        ) : (
          <Ionicons name="close" size={16} color={toneColors.fg} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.stripTitle, { color: toneColors.fg }]}>{strip.title}</Text>
          {strip.sub ? (
            <Text style={[styles.stripSub, { color: toneColors.fg }]}>{strip.sub}</Text>
          ) : null}
        </View>
      </View>

      {/* ── Action row: the next step, never buried ── */}
      <View style={styles.actionRow}>
        {nextAction ? (
          <Button size="sm" onPress={handleActionPress} loading={isUpdating}>
            {nextAction.label}
          </Button>
        ) : null}
        {order.status === "PENDING" ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => onReject(order)}
            disabled={isUpdating}
            textStyle={styles.rejectText}
          >
            Reject
          </Button>
        ) : null}
        {/* Chat opens the moment this order is confirmed and stays readable
            once it closes. */}
        {order.chat_available ? (
          <Pressable
            style={styles.chatBtn}
            onPress={() => onOpenChat(order)}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
            <Text style={styles.chatBtnText}>{order.chat_can_send ? "Chat" : "View chat"}</Text>
            {unreadMessages > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadMessages}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        {canCancel ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => onReject(order)}
            disabled={isUpdating}
            textStyle={styles.rejectText}
          >
            Cancel order
          </Button>
        ) : null}
        <Pressable
          style={styles.detailsBtn}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.detailsBtnText}>{expanded ? "Hide details" : "Details"}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={15}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={styles.cardBody}>
          {/* What the customer asked for comes first — it matters most while
              cooking. */}
          {order.special_instructions ? (
            <View
              style={[
                styles.callout,
                {
                  backgroundColor: colors.status.pending.bg,
                  borderColor: colors.status.pending.border,
                },
              ]}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.status.pending.fg} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.calloutTitle, { color: colors.status.pending.fg }]}>
                  Special instructions
                </Text>
                <Text style={[styles.calloutText, { color: colors.status.pending.fg }]}>
                  “{order.special_instructions}”
                </Text>
              </View>
            </View>
          ) : null}
          {requestInfo?.description ? (
            <View
              style={[
                styles.callout,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Ionicons name="receipt-outline" size={16} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.calloutTitle, { color: colors.foreground }]}>
                  Customer's request
                </Text>
                <Text style={[styles.calloutText, { color: colors.mutedForeground }]}>
                  {requestInfo.description}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>HANDOVER</Text>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailText}>
                  {isDelivery
                    ? "Delivered to the customer"
                    : "Customer picks up from your kitchen"}
                </Text>
                {order.delivery_address ? (
                  <Text style={styles.detailSub}>{order.delivery_address}</Text>
                ) : null}
              </View>
            </View>
            {order.status === "PENDING" ? (
              <Text style={styles.panelNote}>
                You can message the customer once you confirm the order.
              </Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>PROGRESS</Text>
            {isCancelled ? (
              <View style={styles.detailRow}>
                <Ionicons name="close" size={16} color={colors.destructive} />
                <Text style={[styles.detailText, { color: colors.destructive, fontWeight: "600" }]}>
                  This order was cancelled.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.progressRow}>
                  {visibleSteps.map((step, i) => (
                    <View
                      key={step}
                      style={[
                        styles.progressSeg,
                        i <= currentIndex && { backgroundColor: colors.primary },
                      ]}
                    />
                  ))}
                </View>
                <View style={[styles.progressRow, { marginTop: 6 }]}>
                  {visibleSteps.map((step, i) => (
                    <Text
                      key={step}
                      numberOfLines={1}
                      style={[
                        styles.progressLabel,
                        i < currentIndex && { color: colors.foreground },
                        i === currentIndex && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {CHEF_STEP_SHORT[step]}
                    </Text>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.panelNote}>
              Placed{" "}
              {new Date(order.created_at).toLocaleString(undefined, {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

const QUEUES: { key: OrderQueue; label: string }[] = [
  { key: "action", label: "Needs action" },
  { key: "waiting", label: "Waiting" },
  { key: "history", label: "History" },
];

export default function ChefOrdersScreen() {
  const { dbUser } = useAuth();
  // Live unread counts behind the chat badges on each card.
  const { unread: chatUnread } = useChatUnread(Boolean(dbUser));
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [queue, setQueue] = useState<OrderQueue>("action");
  const [orderSearch, setOrderSearch] = useState("");
  const [dishMap, setDishMap] = useState<Map<number, DishInfo>>(new Map());
  const [requestMap, setRequestMap] = useState<Map<number, RequestInfo>>(new Map());
  const isMounted = useRef(true);
  // Ids already looked up (or in flight), so the poll never refetches them.
  const requestedDishIds = useRef(new Set<number>());
  const requestedRequestIds = useRef(new Set<number>());

  // Every card shows its dish photo, and request orders show their brief, so
  // both are resolved for each order as it arrives.
  const enrich = useCallback(async (fetched: Order[]) => {
    const dishIds = [
      ...new Set(
        fetched
          .map((o) => o.items?.[0]?.food_listing_id ?? o.food_listing_id)
          .filter((id): id is number => id != null),
      ),
    ].filter((id) => !requestedDishIds.current.has(id));
    const requestIds = [
      ...new Set(
        fetched.map((o) => o.food_request_id).filter((id): id is number => id != null),
      ),
    ].filter((id) => !requestedRequestIds.current.has(id));
    dishIds.forEach((id) => requestedDishIds.current.add(id));
    requestIds.forEach((id) => requestedRequestIds.current.add(id));

    const [dishResults, requestResults] = await Promise.all([
      Promise.allSettled(dishIds.map((id) => dishService.getDish(id))),
      Promise.allSettled(requestIds.map((id) => requestService.getRequestById(id))),
    ]);
    if (!isMounted.current) return;
    if (dishIds.length) {
      setDishMap((prev) => {
        const next = new Map(prev);
        dishResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const dish = r.value;
            next.set(dishIds[i], {
              title: dish.title,
              image_url:
                dish.images?.find((img) => img.is_primary)?.image_url ??
                dish.images?.[0]?.image_url ??
                null,
            });
          }
        });
        return next;
      });
    }
    if (requestIds.length) {
      setRequestMap((prev) => {
        const next = new Map(prev);
        requestResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            next.set(requestIds[i], {
              title: r.value.title,
              description: r.value.description,
            });
          }
        });
        return next;
      });
    }
  }, []);

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
        void enrich(items);
      } catch {
        // silently fail background poll
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dbUser, enrich]
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
      void enrich(items);
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

  // The order awaiting a confirmation ETA, and the minutes typed into the prompt.
  const [confirmOrderId, setConfirmOrderId] = useState<number | null>(null);
  const [confirmEta, setConfirmEta] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const closeConfirmDialog = () => {
    setConfirmOrderId(null);
    setConfirmEta("");
  };

  const openConfirmDialog = (order: Order) => {
    if (!requireActive()) return;
    setConfirmOrderId(order.id);
    // Pre-filled with the chef's usual prep time, as on the website.
    const defaultPrep = dbUser?.chef_profile?.default_prep_time_minutes;
    setConfirmEta(
      defaultPrep != null && Number.isFinite(defaultPrep) && defaultPrep > 0
        ? String(Math.round(defaultPrep))
        : ""
    );
  };

  /**
   * Confirm the order, optionally replacing the tentative estimate shown at
   * checkout. A blank field keeps whatever estimate the dish already implied.
   */
  const submitConfirmOrder = async () => {
    if (confirmOrderId === null) return;
    const trimmed = confirmEta.trim();
    let etaMinutes: number | undefined;
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert("Invalid time", "Enter the number of minutes, or leave it blank.");
        return;
      }
      etaMinutes = Math.round(parsed);
    }

    setIsConfirming(true);
    setUpdatingId(confirmOrderId);
    try {
      const updated = await orderService.updateOrderStatus(
        confirmOrderId,
        "CONFIRMED",
        etaMinutes
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      closeConfirmDialog();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to confirm order.");
    } finally {
      setIsConfirming(false);
      setUpdatingId(null);
    }
  };

  const handleUpdateStatus = async (orderId: number, status: Order["status"]) => {
    if (!requireActive()) return;
    setUpdatingId(orderId);
    try {
      const updated = await orderService.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
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

  const dishFor = useCallback(
    (order: Order): DishInfo | undefined => {
      const id = order.items?.[0]?.food_listing_id ?? order.food_listing_id;
      return id != null ? dishMap.get(id) : undefined;
    },
    [dishMap],
  );
  const requestFor = useCallback(
    (order: Order): RequestInfo | undefined =>
      order.food_request_id != null ? requestMap.get(order.food_request_id) : undefined,
    [requestMap],
  );

  // Search by order number (with or without the #), any dish on the order,
  // the customer's phone, or the request's title / brief. It runs across all
  // three queues, and each queue's count shows its matches.
  const searchedOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase().replace(/^#/, "");
    if (!query) return orders;
    return orders.filter((order) => {
      const request = requestFor(order);
      return (
        String(order.id).includes(query) ||
        orderItemNames(order, dishFor(order), request).some((n) =>
          n.toLowerCase().includes(query)
        ) ||
        Boolean(order.delivery_phone?.toLowerCase().includes(query)) ||
        Boolean(order.customer_phone?.toLowerCase().includes(query)) ||
        Boolean(request?.title?.toLowerCase().includes(query)) ||
        Boolean(request?.description?.toLowerCase().includes(query))
      );
    });
  }, [orders, orderSearch, dishFor, requestFor]);

  const queueCounts = useMemo(() => {
    const counts: Record<OrderQueue, number> = { action: 0, waiting: 0, history: 0 };
    searchedOrders.forEach((o) => {
      counts[queueFor(o.status)] += 1;
    });
    return counts;
  }, [searchedOrders]);

  const filtered = useMemo(() => {
    const inQueue = searchedOrders.filter((o) => queueFor(o.status) === queue);
    if (queue === "action") {
      return inQueue.sort(
        (a, b) =>
          (ACTION_STAGE_RANK[a.status] ?? 9) - (ACTION_STAGE_RANK[b.status] ?? 9) ||
          time(a.created_at) - time(b.created_at)
      );
    }
    return inQueue.sort((a, b) => time(b.created_at) - time(a.created_at));
  }, [searchedOrders, queue]);

  if (loading) return <LoadingSpinner message="Loading orders…" />;

  const searchQuery = orderSearch.trim();

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

      {/* Queue pills + search */}
      {orders.length > 0 && (
        <View style={styles.controls}>
          <View style={styles.tabs}>
            {QUEUES.map((q) => {
              const active = queue === q.key;
              return (
                <Pressable
                  key={q.key}
                  onPress={() => setQueue(q.key)}
                  style={[styles.tab, active && styles.tabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{q.label}</Text>
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabTextActive]}>
                      {queueCounts[q.key]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search order #, dish, request, or phone"
              placeholderTextColor={colors.mutedForeground}
              value={orderSearch}
              onChangeText={setOrderSearch}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search orders"
            />
            {orderSearch ? (
              <Pressable onPress={() => setOrderSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id.toString()}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            expanded={expandedId === item.id}
            onToggle={() => toggleExpand(item.id)}
            onUpdateStatus={handleUpdateStatus}
            onConfirm={openConfirmDialog}
            onReject={handleReject}
            updatingId={updatingId}
            dishInfo={dishFor(item)}
            requestInfo={requestFor(item)}
            unreadMessages={
              chatUnread.by_order[String(item.id)] ??
              item.unread_message_count ??
              0
            }
            onOpenChat={(order) =>
              router.push({
                pathname: "/order-chat/[id]",
                params: {
                  id: String(order.id),
                  name: order.customer_name ?? "your customer",
                },
              })
            }
          />
        )}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          orders.length === 0 ? (
            <EmptyState icon="📋" title="No orders yet" description="Orders will appear here." />
          ) : searchQuery ? (
            <View style={styles.emptySearch}>
              <Text style={styles.emptyText}>
                No orders match "{searchQuery}"
                {searchedOrders.length > 0 ? " in this queue — check the other queues above." : "."}
              </Text>
              <Button variant="outline" size="sm" onPress={() => setOrderSearch("")}>
                Clear search
              </Button>
            </View>
          ) : (
            <View style={styles.emptySearch}>
              <Text style={styles.emptyText}>No orders in this queue.</Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
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

      <Modal
        visible={confirmOrderId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isConfirming) closeConfirmDialog();
        }}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm order #{confirmOrderId}</Text>
            <Text style={styles.modalDescription}>
              Tell the customer how long this order will take. This replaces the
              tentative estimate shown at checkout.
            </Text>

            <Input
              label="Ready in (minutes)"
              placeholder="e.g. 45"
              helperText="Leave blank to keep the existing estimate."
              keyboardType="number-pad"
              value={confirmEta}
              onChangeText={setConfirmEta}
              editable={!isConfirming}
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={closeConfirmDialog}
                disabled={isConfirming}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                onPress={submitConfirmOrder}
                loading={isConfirming}
                style={styles.modalButton}
              >
                Confirm order
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { ...typography.lg, fontWeight: "700", color: colors.foreground },
  modalDescription: { ...typography.sm, color: colors.mutedForeground },
  modalActions: { flexDirection: "row", gap: spacing.sm },
  modalButton: { flex: 1 },

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

  controls: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.xs, fontWeight: "600", color: colors.mutedForeground },
  tabTextActive: { color: colors.primaryForeground },
  tabCount: {
    minWidth: 18,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabCountText: { fontSize: 10, lineHeight: 14, fontWeight: "700", color: colors.mutedForeground },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm + 4,
  },
  searchInput: {
    flex: 1,
    ...typography.sm,
    color: colors.foreground,
    paddingVertical: Platform.OS === "ios" ? 9 : 5,
  },

  listContent: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptySearch: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  emptyText: { ...typography.base, color: colors.mutedForeground, textAlign: "center" },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
    overflow: "hidden",
  },
  cardExpanded: { borderColor: `${colors.primary}4D`, ...shadow.md },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 4,
    gap: spacing.sm + 4,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbImg: { width: "100%", height: "100%" },
  headerMain: { flex: 1, minWidth: 0, gap: 4 },
  orderTitle: { ...typography.base, fontWeight: "700", color: colors.foreground },
  headerTags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  idChip: {
    backgroundColor: colors.muted,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  idChipText: {
    ...typography.xs,
    color: colors.mutedForeground,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { ...typography.xs, fontWeight: "600", color: colors.foreground },
  cookingList: { ...typography.sm, color: colors.foreground },
  bold: { fontWeight: "700" },
  headerRight: { alignItems: "flex-end", flexShrink: 0 },
  orderTotal: { ...typography.base, fontWeight: "700", color: colors.foreground },
  struck: { color: colors.mutedForeground, textDecorationLine: "line-through" },
  payText: { ...typography.xs, color: colors.mutedForeground },

  strip: {
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
  },
  stripTitle: { ...typography.sm, fontWeight: "700" },
  stripSub: { ...typography.xs, fontWeight: "500", opacity: 0.9, marginTop: 1 },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
  },
  rejectText: { color: colors.destructive },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  chatBtnText: { ...typography.sm, fontWeight: "600", color: colors.primary },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { ...typography.xs, fontWeight: "700", color: colors.primaryForeground },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  detailsBtnText: { ...typography.sm, fontWeight: "600", color: colors.primary },

  cardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm + 4,
  },
  callout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  calloutTitle: { ...typography.sm, fontWeight: "700" },
  calloutText: { ...typography.sm },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  panelTitle: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    marginBottom: spacing.sm + 2,
  },
  panelNote: { ...typography.xs, color: colors.mutedForeground, marginTop: spacing.sm + 4 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  detailText: { ...typography.sm, color: colors.foreground, flex: 1 },
  detailSub: { ...typography.sm, color: colors.mutedForeground },
  progressRow: { flexDirection: "row", gap: 6 },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: `${colors.foreground}1A`,
  },
  progressLabel: { flex: 1, fontSize: 10, lineHeight: 14, color: colors.mutedForeground },

  loadMore: { margin: spacing.md },
});
