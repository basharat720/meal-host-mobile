import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { orderService } from "@/services/orderService";
import { reviewService } from "@/services/reviewService";
import { dishService } from "@/services/dishService";
import { requestService } from "@/services/requestService";
import { userService } from "@/services/userService";
import { Order, FoodRequest } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STEPS: Order["status"][] = [
  "PENDING",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "RECEIVED",
  "COMPLETED",
];

const STEP_LABELS: Record<Order["status"], string> = {
  PENDING: "Order Placed",
  CONFIRMED: "Chef Confirmed",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED: "Delivered",
  RECEIVED: "Received",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ACTIVE_STATUSES = new Set<Order["status"]>([
  "PENDING",
  "CONFIRMED",
  "READY_FOR_PICKUP",
]);

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline";

const getStatusBadgeVariant = (status: Order["status"]): BadgeVariant => {
  switch (status) {
    case "PENDING": return "warning";
    case "CONFIRMED": return "outline";
    case "READY_FOR_PICKUP": return "success";
    case "DELIVERED":
    case "RECEIVED":
    case "COMPLETED": return "default";
    case "CANCELLED": return "destructive";
    default: return "default";
  }
};

const sortOrders = (orders: Order[]): Order[] =>
  [...orders].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.has(a.status) ? 1 : 0;
    const bActive = ACTIVE_STATUSES.has(b.status) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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

// ── Types ─────────────────────────────────────────────────────────────────────

type DishInfo = { title: string; imageUrl: string | null };
type RequestInfo = { title: string; description?: string };
type ChefInfo = { address: string; phone?: string };

// ── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  order: Order;
  customerId: number;
  onClose: () => void;
  onSubmitted: (orderId: number) => void;
}

function ReviewModal({ order, customerId, onClose, onSubmitted }: ReviewModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (stars === 0) {
      setError("Please select a star rating.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await reviewService.submitReview(
        order.id,
        customerId,
        stars,
        comment.trim() || undefined
      );
      onSubmitted(order.id);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <Text style={modalStyles.title}>Leave a Review</Text>
          <Text style={modalStyles.subtitle}>How was your order?</Text>

          {/* Stars */}
          <View style={modalStyles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                <Ionicons
                  name={n <= stars ? "star" : "star-outline"}
                  size={36}
                  color={n <= stars ? colors.warning : colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>

          {/* Comment */}
          <TextInput
            style={modalStyles.commentInput}
            placeholder="Leave a comment... (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {error ? <Text style={modalStyles.error}>{error}</Text> : null}

          <View style={modalStyles.buttons}>
            <Button variant="outline" size="md" style={modalStyles.cancelBtn} onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              style={modalStyles.submitBtn}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Submit
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.xl, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  subtitle: { ...typography.base, color: colors.mutedForeground, textAlign: "center" },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  commentInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.base,
    color: colors.foreground,
    backgroundColor: colors.background,
    minHeight: 80,
  },
  error: { ...typography.sm, color: colors.destructive, textAlign: "center" },
  buttons: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 1 },
});

// ── Order Card ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  dish: DishInfo | undefined;
  requestInfo: RequestInfo | undefined;
  chefInfo: ChefInfo | undefined;
  isExpanded: boolean;
  isReceiving: boolean;
  hasReviewed: boolean;
  onToggle: (id: number) => void;
  onMarkReceived: (order: Order) => void;
  onLeaveReview: (order: Order) => void;
}

function OrderCard({
  order,
  dish,
  requestInfo,
  chefInfo,
  isExpanded,
  isReceiving,
  hasReviewed,
  onToggle,
  onMarkReceived,
  onLeaveReview,
}: OrderCardProps) {
  const { formatPrice } = useI18n();
  const currentIndex =
    order.status === "CANCELLED" ? -1 : STATUS_STEPS.indexOf(order.status);

  const dishName =
    dish?.title ??
    requestInfo?.title ??
    (order.food_listing_id != null
      ? `Dish #${order.food_listing_id}`
      : order.food_request_id != null
      ? `Custom Request #${order.food_request_id}`
      : "Order");

  const confirmedEta = formatConfirmedEta(order);
  const tentativeEta = formatTentativeEta(order);
  const showEtaInHeader =
    ACTIVE_STATUSES.has(order.status) &&
    (confirmedEta != null || (order.status === "PENDING" && tentativeEta != null));

  const address = order.delivery_address || chefInfo?.address;
  const phone = order.delivery_phone || chefInfo?.phone;

  return (
    <View style={cardStyles.container}>
      {/* Collapsed Header */}
      <Pressable
        style={cardStyles.header}
        onPress={() => onToggle(order.id)}
        android_ripple={{ color: colors.muted }}
      >
        <View style={cardStyles.imageBox}>
          {dish?.imageUrl ? (
            <Image
              source={{ uri: dish.imageUrl }}
              style={cardStyles.image}
              contentFit="cover"
            />
          ) : (
            <View style={cardStyles.imagePlaceholder}>
              <Ionicons name="bag-outline" size={22} color={colors.mutedForeground} />
            </View>
          )}
        </View>

        <View style={cardStyles.summary}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.dishName} numberOfLines={1}>
              {dishName}
            </Text>
            <View style={cardStyles.orderIdBadge}>
              <Text style={cardStyles.orderIdText}>#{order.id}</Text>
            </View>
          </View>
          <View style={cardStyles.metaRow}>
            <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
            <Text style={cardStyles.metaText}>
              {new Date(order.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {" · "}Qty {order.quantity}
            </Text>
          </View>
          <View style={cardStyles.statusRow}>
            <Badge
              label={STEP_LABELS[order.status]}
              variant={getStatusBadgeVariant(order.status)}
            />
            <Text style={cardStyles.amount}>
              {formatPrice(order.total_amount)}
            </Text>
          </View>
          {showEtaInHeader && (
            <View style={cardStyles.etaRow}>
              <Ionicons name="time-outline" size={12} color={confirmedEta ? colors.foreground : colors.mutedForeground} />
              <Text style={confirmedEta ? cardStyles.etaConfirmed : cardStyles.etaTentative}>
                {confirmedEta
                  ? `Arriving by ${confirmedEta}`
                  : `Est. ${tentativeEta}`}
              </Text>
            </View>
          )}
        </View>

        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      {/* Expanded Panel */}
      {isExpanded && (
        <View style={cardStyles.expandedPanel}>
          <View style={cardStyles.separator} />

          {/* Order Summary */}
          <View style={cardStyles.detailSection}>
            <Text style={cardStyles.detailSectionTitle}>
              {"  ORDER SUMMARY"}
            </Text>
            <View style={cardStyles.summaryBox}>
              <View style={cardStyles.summaryImageBox}>
                {dish?.imageUrl ? (
                  <Image source={{ uri: dish.imageUrl }} style={cardStyles.summaryImage} contentFit="cover" />
                ) : (
                  <View style={cardStyles.imagePlaceholder}>
                    <Ionicons name="bag-outline" size={16} color={colors.mutedForeground} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cardStyles.detailText} numberOfLines={2}>{dishName}</Text>
                {requestInfo?.description ? (
                  <Text style={cardStyles.detailSubText} numberOfLines={2}>{requestInfo.description}</Text>
                ) : null}
                <Text style={cardStyles.detailSubText}>
                  {order.quantity} × {formatPrice(order.total_amount / order.quantity)}
                </Text>
                <View style={cardStyles.totalRow}>
                  <Text style={cardStyles.detailSubText}>Total</Text>
                  <Text style={cardStyles.totalAmount}>
                    {formatPrice(order.total_amount)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pickup Details */}
          {(address || phone) ? (
            <View style={cardStyles.detailSection}>
              <Text style={cardStyles.detailSectionTitle}>
                {"  PICKUP DETAILS"}
              </Text>
              <View style={cardStyles.detailBox}>
                {address ? (
                  <View style={cardStyles.detailRow}>
                    <Ionicons name="location" size={14} color={colors.primary} />
                    <Text style={cardStyles.detailText}>{address}</Text>
                  </View>
                ) : null}
                {phone ? (
                  <View style={cardStyles.detailRow}>
                    <Ionicons name="call" size={14} color={colors.primary} />
                    <Text style={cardStyles.detailText}>{phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Special Instructions */}
          {order.special_instructions ? (
            <View style={cardStyles.detailSection}>
              <Text style={cardStyles.detailSectionTitle}>
                {"  SPECIAL INSTRUCTIONS"}
              </Text>
              <View style={cardStyles.instructionsBox}>
                <Text style={cardStyles.instructionsText}>
                  "{order.special_instructions}"
                </Text>
              </View>
            </View>
          ) : null}

          {/* Progress Stepper */}
          <View style={cardStyles.detailSection}>
            <Text style={cardStyles.detailSectionTitle}>
              {"  ORDER PROGRESS"}
            </Text>
            <View style={cardStyles.stepperContainer}>
              {order.status === "CANCELLED" ? (
                <>
                  {STATUS_STEPS.map((step) => (
                    <View key={step} style={cardStyles.stepRow}>
                      <View style={cardStyles.stepDotInactive} />
                      <Text style={cardStyles.stepLabelInactive}>{STEP_LABELS[step]}</Text>
                    </View>
                  ))}
                  <View style={cardStyles.stepRow}>
                    <View style={cardStyles.stepDotCancelled}>
                      <Ionicons name="close" size={10} color={colors.destructive} />
                    </View>
                    <Text style={cardStyles.stepLabelCancelled}>Cancelled</Text>
                  </View>
                </>
              ) : (
                STATUS_STEPS.map((step, i) => {
                  const isPast = i < currentIndex;
                  const isCurrent = i === currentIndex;
                  return (
                    <View key={step} style={cardStyles.stepRow}>
                      {isPast ? (
                        <View style={cardStyles.stepDotDone}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      ) : isCurrent ? (
                        <View style={cardStyles.stepDotCurrent} />
                      ) : (
                        <View style={cardStyles.stepDotInactive} />
                      )}
                      <Text
                        style={
                          isPast
                            ? cardStyles.stepLabelDone
                            : isCurrent
                            ? cardStyles.stepLabelCurrent
                            : cardStyles.stepLabelInactive
                        }
                      >
                        {STEP_LABELS[step]}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Mark as Received */}
          {order.status === "DELIVERED" && (
            <View style={cardStyles.actionSection}>
              <Text style={cardStyles.actionNote}>
                Your order has been delivered. Please confirm once you've picked it up.
              </Text>
              <Button
                variant="primary"
                size="sm"
                onPress={() => onMarkReceived(order)}
                loading={isReceiving}
                disabled={isReceiving}
              >
                Confirm I Received My Order
              </Button>
            </View>
          )}

          {/* Leave Review (on RECEIVED, matching web) */}
          {order.status === "RECEIVED" && !hasReviewed && (
            <View style={cardStyles.actionSection}>
              <View style={cardStyles.reviewPromptRow}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={cardStyles.reviewPromptText}>How was your order?</Text>
              </View>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => onLeaveReview(order)}
              >
                Leave Review
              </Button>
            </View>
          )}

          {order.status === "RECEIVED" && hasReviewed && (
            <View style={cardStyles.reviewedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={cardStyles.reviewedText}>Thanks for your review!</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    ...shadow.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  imageBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
    flexShrink: 0,
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 },
  dishName: { ...typography.base, fontWeight: "600", color: colors.foreground, flex: 1 },
  orderIdBadge: {
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  orderIdText: { ...typography.xs, color: colors.mutedForeground, fontFamily: "monospace" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.xs },
  metaText: { ...typography.xs, color: colors.mutedForeground },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amount: { ...typography.sm, fontWeight: "700", color: colors.primary },
  etaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  etaConfirmed: { ...typography.xs, fontWeight: "600", color: colors.foreground },
  etaTentative: { ...typography.xs, color: colors.mutedForeground },
  expandedPanel: { paddingBottom: spacing.md },
  separator: {
    height: 1,
    borderStyle: "dashed",
    borderTopWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  detailSection: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  detailSectionTitle: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  summaryBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  summaryImageBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    overflow: "hidden",
    flexShrink: 0,
  },
  summaryImage: { width: "100%", height: "100%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  totalAmount: { ...typography.sm, fontWeight: "700", color: colors.primary },
  detailBox: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  detailText: { ...typography.sm, color: colors.foreground, flex: 1 },
  detailSubText: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  instructionsBox: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.accentForeground}22`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  instructionsText: { ...typography.sm, color: colors.foreground, fontStyle: "italic" },
  stepperContainer: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    marginLeft: -10,
  },
  stepDotDone: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepDotCurrent: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  stepDotInactive: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    flexShrink: 0,
  },
  stepDotCancelled: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: `${colors.destructive}1A`,
    borderWidth: 2,
    borderColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepLabelDone: { ...typography.sm, color: colors.success, fontWeight: "600" },
  stepLabelCurrent: { ...typography.sm, color: colors.primary, fontWeight: "700" },
  stepLabelInactive: { ...typography.sm, color: colors.mutedForeground },
  stepLabelCancelled: { ...typography.sm, color: colors.destructive, fontWeight: "600" },
  actionSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  actionNote: { ...typography.sm, color: colors.mutedForeground },
  reviewPromptRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  reviewPromptText: { ...typography.base, fontWeight: "600", color: colors.foreground },
  reviewedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  reviewedText: { ...typography.sm, fontWeight: "600", color: colors.primary },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { user, dbUser } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dishMap, setDishMap] = useState<Map<number, DishInfo>>(new Map());
  const [requestMap, setRequestMap] = useState<Map<number, RequestInfo>>(new Map());
  const [chefMap, setChefMap] = useState<Map<string, ChefInfo>>(new Map());
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<number>>(new Set());
  const [receivingOrderId, setReceivingOrderId] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null);

  const hasMore = orders.length < total;
  const isMounted = useRef(true);
  const hasLoadedRef = useRef(false);
  // Mirror the current order count in a ref so `fetchOrders` can preserve the
  // loaded page size without depending on `orders.length` (which would make the
  // focus effect re-run on every data change).
  const ordersLengthRef = useRef(0);
  useEffect(() => {
    ordersLengthRef.current = orders.length;
  }, [orders.length]);

  const enrichDishes = useCallback(
    async (fetched: Order[], currentMap: Map<number, DishInfo>) => {
      const newIds = [
        ...new Set(
          fetched
            .map((o) => o.food_listing_id)
            .filter((id): id is number => id != null)
        ),
      ].filter((id) => !currentMap.has(id));

      if (newIds.length === 0) return;

      const results = await Promise.allSettled(
        newIds.map((id) => dishService.getDish(id))
      );
      setDishMap((prev) => {
        const next = new Map(prev);
        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            const dish = result.value;
            next.set(newIds[i], {
              title: dish.title,
              imageUrl:
                dish.images?.find((img) => img.is_primary)?.image_url ??
                dish.images?.[0]?.image_url ??
                null,
            });
          }
        });
        return next;
      });
    },
    []
  );

  const enrichRequests = useCallback(
    async (fetched: Order[], currentMap: Map<number, RequestInfo>, customerId: number) => {
      const hasRequestOrders = fetched.some((o) => o.food_request_id != null);
      if (!hasRequestOrders) return;

      const newIds = new Set(
        fetched
          .map((o) => o.food_request_id)
          .filter((id): id is number => id != null && !currentMap.has(id))
      );
      if (newIds.size === 0) return;

      try {
        const page = await requestService.getCustomerRequests(customerId, 0, 200);
        setRequestMap((prev) => {
          const next = new Map(prev);
          page.items.forEach((r: FoodRequest) => {
            if (newIds.has(r.id)) {
              next.set(r.id, { title: r.title, description: r.description });
            }
          });
          return next;
        });
      } catch {
        // silently fail
      }
    },
    []
  );

  const enrichChefs = useCallback(
    async (fetched: Order[], currentMap: Map<string, ChefInfo>) => {
      const newChefIds = [
        ...new Set(
          fetched
            .filter(
              (o) =>
                o.food_request_id != null &&
                !o.delivery_address &&
                !currentMap.has(o.chef_id)
            )
            .map((o) => o.chef_id)
        ),
      ];
      if (newChefIds.length === 0) return;

      const results = await Promise.allSettled(
        newChefIds.map((id) => userService.getUserById(id))
      );
      setChefMap((prev) => {
        const next = new Map(prev);
        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            const chef = result.value;
            const primaryLocation =
              chef.locations?.find((l) => l.is_primary) ?? chef.locations?.[0];
            if (primaryLocation?.address) {
              next.set(newChefIds[i], {
                address: primaryLocation.address,
                phone: chef.phone,
              });
            }
          }
        });
        return next;
      });
    },
    []
  );

  const fetchOrders = useCallback(
    async (isInitial = false) => {
      if (!dbUser) return;
      if (isInitial) setIsLoading(true);
      try {
        const currentCount = isInitial ? 0 : ordersLengthRef.current;
        const limitToUse = Math.max(currentCount, 20);
        const page = await orderService.getCustomerOrders(
          dbUser.id as number,
          0,
          limitToUse
        );
        const sorted = sortOrders(page.items);
        if (!isMounted.current) return;
        setFetchError(null);
        setOrders(sorted);
        setTotal(page.total);
        await enrichDishes(sorted, new Map());
        await enrichRequests(sorted, new Map(), dbUser.id as number);
        await enrichChefs(sorted, new Map());
      } catch {
        if (isInitial && isMounted.current) {
          setFetchError("Couldn't load your orders. Check your connection and try again.");
        }
      } finally {
        if (isInitial && isMounted.current) setIsLoading(false);
      }
    },
    [dbUser, enrichDishes, enrichRequests, enrichChefs]
  );

  const loadMore = useCallback(async () => {
    if (!dbUser || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await orderService.getCustomerOrders(
        dbUser.id as number,
        orders.length,
        20
      );
      const newItems = sortOrders(page.items);
      if (!isMounted.current) return;
      setOrders((prev) => sortOrders([...prev, ...newItems]));
      setTotal(page.total);
      await enrichDishes(newItems, dishMap);
      await enrichRequests(newItems, requestMap, dbUser.id as number);
      await enrichChefs(newItems, chefMap);
    } catch {
      // silently fail
    } finally {
      if (isMounted.current) setIsLoadingMore(false);
    }
  }, [dbUser, isLoadingMore, orders.length, enrichDishes, enrichRequests, enrichChefs, dishMap, requestMap, chefMap]);

  // Track real mount/unmount so we don't call setState on an unmounted screen.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Refetch on every focus (fresh data when you switch back to the tab) and poll
  // every 30s while the screen is focused. The first load shows the full loader;
  // subsequent focuses refetch silently, keeping the current list on screen.
  useFocusEffect(
    useCallback(() => {
      fetchOrders(!hasLoadedRef.current);
      hasLoadedRef.current = true;
      const interval = setInterval(() => fetchOrders(false), 30_000);
      return () => clearInterval(interval);
    }, [fetchOrders])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders(false);
    } finally {
      if (isMounted.current) setIsRefreshing(false);
    }
  }, [fetchOrders]);

  const toggleExpand = (id: number) =>
    setExpandedOrderId((prev) => (prev === id ? null : id));

  const markReceived = async (order: Order) => {
    setReceivingOrderId(order.id);
    try {
      const updated = await orderService.updateOrderStatus(order.id, "RECEIVED");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update order status.");
    } finally {
      setReceivingOrderId(null);
    }
  };

  const handleReviewSubmitted = (orderId: number) => {
    setReviewedOrderIds((prev) => new Set(prev).add(orderId));
  };

  // ── Not logged in ──
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <EmptyState
          icon="🔒"
          title="Sign in to view orders"
          description="Please sign in to see your order history."
          actionLabel="Sign In"
          onAction={() =>
            router.push({
              pathname: "/(auth)/customer-login",
              params: { redirect: "/(tabs)/orders" },
            })
          }
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <FullScreenLoader message="Loading orders…" />;
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={styles.errorTitle}>Couldn't load your orders</Text>
          <Text style={styles.errorSubtitle}>
            Check your connection and try again.
          </Text>
          <Button variant="primary" size="md" onPress={() => fetchOrders(true)}>
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        {total > 0 && (
          <Text style={styles.headerSubtitle}>
            Showing {orders.length} of {total} order{total !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {orders.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="No orders yet"
          description="Your order history will appear here once you place your first order."
          actionLabel="Browse Chefs"
          onAction={() => router.push("/(tabs)/chefs")}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              dish={
                item.food_listing_id != null
                  ? dishMap.get(item.food_listing_id)
                  : undefined
              }
              requestInfo={
                item.food_request_id != null
                  ? requestMap.get(item.food_request_id)
                  : undefined
              }
              chefInfo={chefMap.get(item.chef_id)}
              isExpanded={expandedOrderId === item.id}
              isReceiving={receivingOrderId === item.id}
              hasReviewed={reviewedOrderIds.has(item.id)}
              onToggle={toggleExpand}
              onMarkReceived={markReceived}
              onLeaveReview={setReviewTarget}
            />
          )}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.loadMoreContainer}>
                <Button
                  variant="outline"
                  size="md"
                  onPress={loadMore}
                  loading={isLoadingMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore
                    ? "Loading…"
                    : `Load More (${total - orders.length} remaining)`}
                </Button>
              </View>
            ) : null
          }
        />
      )}

      {reviewTarget && dbUser && (
        <ReviewModal
          order={reviewTarget}
          customerId={dbUser.id as number}
          onClose={() => setReviewTarget(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
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
    paddingBottom: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  errorSubtitle: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
});
