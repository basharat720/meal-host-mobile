import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { orderService } from "@/services/orderService";
import { reviewService } from "@/services/reviewService";
import { dishService } from "@/services/dishService";
import { requestService } from "@/services/requestService";
import { userService } from "@/services/userService";
import { Order, FoodRequest } from "@/services/types";
import { formatDurationRange } from "@/lib/duration";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { useChatUnread } from "@/hooks/useOrderChat";
import {
  getOrderItemKey,
  getOrderItemName,
  getOrderListingName,
} from "@/lib/listingVariants";
import { toTitleCase } from "@/lib/titleCase";

// ── Status helpers ────────────────────────────────────────────────────────────
// Ported from meal-host-frontend `src/pages/CustomerOrdersPage.tsx` so a card
// says the same thing in the app as on the website.

// Pal reacts to where the order actually is. Cancelled gets no mascot — a
// character has nothing useful to add to bad news.
const STATUS_POSE: Partial<Record<Order["status"], MascotPose>> = {
  PENDING: "idle",
  CONFIRMED: "cooking",
  READY_FOR_PICKUP: "delivering",
  DELIVERED: "flying",
  RECEIVED: "celebrating",
  COMPLETED: "love",
};

// The status strip's tint, from the shared status palette.
type StripTone = keyof typeof colors.status;
const STRIP_TONE: Record<Order["status"], StripTone> = {
  PENDING: "pending",
  CONFIRMED: "active",
  READY_FOR_PICKUP: "ready",
  DELIVERED: "ready",
  RECEIVED: "done",
  COMPLETED: "done",
  CANCELLED: "cancelled",
};

// What the strip says, in the customer's words rather than status names.
const statusStripCopy = (
  order: Order,
  chefName: string,
  reviewed: boolean,
): { title: string; sub?: string } => {
  const isDelivery = order.delivery_type === "delivery";
  switch (order.status) {
    case "PENDING":
      return {
        title: `Waiting for ${chefName} to confirm`,
        sub: "Your order has been sent to the kitchen.",
      };
    case "CONFIRMED":
      return {
        title: `${chefName} is cooking your order`,
        sub: "Your delicious meal is being prepared.",
      };
    case "READY_FOR_PICKUP":
      return isDelivery
        ? { title: "Packed and ready to go", sub: "It will be on its way shortly." }
        : { title: "Your order is ready!", sub: "Head over to pick it up." };
    case "DELIVERED":
      return isDelivery
        ? { title: "On its way to you", sub: "Confirm once it reaches your door." }
        : { title: "Handed over", sub: "Confirm once you have it." };
    case "RECEIVED":
      return reviewed
        ? { title: "Enjoy your meal!", sub: "Thanks for your review!" }
        : {
            title: "Enjoy your meal!",
            sub: `How was it? Your rating helps ${chefName}.`,
          };
    case "COMPLETED":
      return { title: "Hope you enjoyed it!", sub: "This order is complete." };
    case "CANCELLED":
      return {
        title: "Order cancelled",
        sub: order.cancellation_reason
          ? `Reason: ${order.cancellation_reason}`
          : undefined,
      };
  }
};

// The four-part bar on the strip. "Completed" shares the last part with
// "Received". The part the order is in is half-filled; "Placed" happens the
// moment the order exists, so it is filled straight away.
const orderProgress = (
  order: Order,
): { steps: string[]; index: number; fill: number } | null => {
  const isDelivery = order.delivery_type === "delivery";
  const steps = [
    "Placed",
    "Preparing",
    isDelivery ? "Out for delivery" : "Ready for pickup",
    isDelivery ? "Received" : "Picked up",
  ];
  switch (order.status) {
    case "PENDING":
      return { steps, index: 0, fill: 1 };
    case "CONFIRMED":
      return { steps, index: 1, fill: 0.5 };
    case "READY_FOR_PICKUP":
      // A delivery order that is packed has not left yet.
      return isDelivery
        ? { steps, index: 2, fill: 0.15 }
        : { steps, index: 2, fill: 1 };
    case "DELIVERED":
      return isDelivery
        ? { steps, index: 2, fill: 0.5 }
        : { steps, index: 3, fill: 0.5 };
    default:
      // Received and completed orders show stars or a finished note instead.
      return null;
  }
};

const UPCOMING_STATUSES = new Set<Order["status"]>(["PENDING", "CONFIRMED"]);
const IN_TRANSIT_STATUSES = new Set<Order["status"]>([
  "READY_FOR_PICKUP",
  "DELIVERED",
]);
const COMPLETED_STATUSES = new Set<Order["status"]>(["RECEIVED", "COMPLETED"]);

type TabType = "upcoming" | "in-transit" | "completed" | "cancelled";

const TABS: { key: TabType; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "in-transit", label: "In transit" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const getTabForStatus = (status: Order["status"]): TabType => {
  if (UPCOMING_STATUSES.has(status)) return "upcoming";
  if (IN_TRANSIT_STATUSES.has(status)) return "in-transit";
  if (COMPLETED_STATUSES.has(status)) return "completed";
  return "cancelled";
};

// Newest first.
const sortOrders = (orders: Order[]): Order[] =>
  [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

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

/** Opens the platform's maps app on an address. */
const openDirections = (address: string) => {
  const q = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.openURL(url).catch(() =>
    Alert.alert("Couldn't open Maps", address),
  );
};

const callPhone = (phone: string) => {
  Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() =>
    Alert.alert("Couldn't start a call", phone),
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

type DishInfo = { title: string; imageUrl: string | null };
type RequestInfo = { title: string; description?: string };
type ChefInfo = { address: string; phone?: string };

/** Every dish title on the order, from its own snapshotted lines when it has them. */
const orderItemNames = (
  order: Order,
  dish: DishInfo | undefined,
  requestInfo: RequestInfo | undefined,
): string[] => {
  if (order.items?.length) return order.items.map(getOrderItemName);
  const fallback =
    dish?.title ??
    requestInfo?.title ??
    (order.food_listing_id != null
      ? `Dish #${order.food_listing_id}`
      : order.food_request_id != null
        ? `Custom Request #${order.food_request_id}`
        : "Order");
  return [getOrderListingName(order, fallback)];
};

// ── Small pieces ─────────────────────────────────────────────────────────────

function Tag({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={cardStyles.tag}>
      <Ionicons name={icon} size={13} color={colors.foreground} />
      <Text style={cardStyles.tagText}>{label}</Text>
    </View>
  );
}

function ProgressBar({
  progress,
  tone,
}: {
  progress: { steps: string[]; index: number; fill: number };
  tone: StripTone;
}) {
  return (
    <View style={cardStyles.progressWrap}>
      <View style={cardStyles.progressRow}>
        {progress.steps.map((label, i) => {
          const pct =
            i < progress.index ? 100 : i === progress.index ? progress.fill * 100 : 0;
          return (
            <View key={label} style={cardStyles.progressTrack}>
              <View style={[cardStyles.progressFill, { width: `${pct}%` }]} />
            </View>
          );
        })}
      </View>
      <View style={cardStyles.progressRow}>
        {progress.steps.map((label, i) => (
          <Text
            key={label}
            numberOfLines={1}
            style={[
              cardStyles.progressLabel,
              { color: colors.status[tone].fg, opacity: 0.75 },
              i < progress.index && { opacity: 1 },
              i === progress.index && cardStyles.progressLabelCurrent,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  dish: DishInfo | undefined;
  requestInfo: RequestInfo | undefined;
  chefInfo: ChefInfo | undefined;
  isExpanded: boolean;
  isReceiving: boolean;
  hasReviewed: boolean;
  customerId: number | null;
  onToggle: (id: number) => void;
  onMarkReceived: (order: Order) => void;
  onReviewSubmitted: (orderId: number) => void;
  /** Live unread count for this order's chat, ahead of the orders payload. */
  unreadMessages: number;
  onOpenChat: (order: Order) => void;
  onOrderAgain: (listingId: number) => void;
}

function OrderCard({
  order,
  dish,
  requestInfo,
  chefInfo,
  isExpanded,
  isReceiving,
  hasReviewed,
  customerId,
  onToggle,
  onMarkReceived,
  onReviewSubmitted,
  unreadMessages,
  onOpenChat,
  onOrderAgain,
}: OrderCardProps) {
  const { formatPrice } = useI18n();

  // Inline review on the strip — a star opens the comment box.
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const names = orderItemNames(order, dish, requestInfo);
  const dishName =
    names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0];
  const primaryListingId =
    order.items?.[0]?.food_listing_id ?? order.food_listing_id;
  const isDelivery = order.delivery_type === "delivery";
  const isCancelled = order.status === "CANCELLED";
  const chefName = toTitleCase(order.chef_name) || "the kitchen";
  const address = order.delivery_address || chefInfo?.address;
  const phone = order.delivery_phone || chefInfo?.phone;
  const itemCount = order.items?.length
    ? order.items.reduce((sum, item) => sum + item.quantity, 0)
    : order.quantity;
  const progress = orderProgress(order);
  const strip = statusStripCopy(order, chefName, hasReviewed);
  const pose = STATUS_POSE[order.status];
  const tone = STRIP_TONE[order.status];
  const toneColors = colors.status[tone];
  const canReview = order.status === "RECEIVED" && !hasReviewed;
  const isActive =
    UPCOMING_STATUSES.has(order.status) || IN_TRANSIT_STATUSES.has(order.status);
  const confirmedEta = formatConfirmedEta(order);
  const tentativeEta = formatTentativeEta(order);
  const etaLabel = !isActive
    ? null
    : confirmedEta
      ? `${isDelivery ? "Arriving" : "Ready"} by ${confirmedEta}`
      : tentativeEta
        ? `${isDelivery ? "Arrives" : "Ready"} in about ${tentativeEta}`
        : null;

  const submitReview = async () => {
    if (!customerId) return;
    if (stars === 0) {
      setReviewError("Please select a star rating.");
      return;
    }
    setReviewError(null);
    setSubmitting(true);
    try {
      await reviewService.submitReview(
        order.id,
        customerId,
        stars,
        comment.trim() || undefined,
      );
      onReviewSubmitted(order.id);
    } catch (err: any) {
      setReviewError(
        getUserFriendlyError(err, "Failed to submit. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={[cardStyles.container, isExpanded && cardStyles.containerExpanded]}
    >
      {/* ── Header: what, from whom, how much ── */}
      <Pressable
        style={cardStyles.header}
        onPress={() => onToggle(order.id)}
        android_ripple={{ color: colors.muted }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={[cardStyles.imageBox, isCancelled && { opacity: 0.6 }]}>
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
          <Text
            style={[cardStyles.dishName, isCancelled && cardStyles.mutedText]}
            numberOfLines={1}
          >
            {dishName}
          </Text>
          <Text style={cardStyles.metaText} numberOfLines={2}>
            {chefName}
            {"  ·  "}
            <Text style={cardStyles.orderId}>#{order.id}</Text>
            {"  ·  "}
            {new Date(order.created_at).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View style={cardStyles.priceCol}>
          <Text
            style={[cardStyles.amount, isCancelled && cardStyles.amountStruck]}
          >
            {formatPrice(order.total_amount)}
          </Text>
          <Text style={cardStyles.itemCount}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Text>
        </View>
      </Pressable>

      {/* ── Status strip: where the order is, in words ── */}
      <View style={[cardStyles.strip, { backgroundColor: toneColors.bg }]}>
        {pose ? (
          <Mascot pose={pose} height={56} style={cardStyles.stripMascot} />
        ) : (
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={toneColors.fg}
            style={{ alignSelf: "flex-start" }}
          />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[cardStyles.stripTitle, { color: toneColors.fg }]}>
            {strip.title}
          </Text>
          {strip.sub ? (
            <Text style={[cardStyles.stripSub, { color: toneColors.fg }]}>
              {strip.sub}
            </Text>
          ) : null}
          {etaLabel ? (
            <View style={cardStyles.etaPill}>
              <Ionicons name="time-outline" size={12} color={colors.foreground} />
              <Text style={cardStyles.etaText}>{etaLabel}</Text>
            </View>
          ) : null}
          {canReview ? (
            <View
              style={cardStyles.starsRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Rate this order"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setStars(n)}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: stars === n }}
                  accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
                  style={cardStyles.starBtn}
                >
                  <Ionicons
                    name={n <= stars ? "star" : "star-outline"}
                    size={26}
                    color={n <= stars ? colors.rating : toneColors.fg}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
          {progress ? <ProgressBar progress={progress} tone={tone} /> : null}
        </View>
      </View>

      {/* A star opens the rest of the review. */}
      {canReview && stars > 0 ? (
        <View style={cardStyles.reviewBox}>
          <TextInput
            style={cardStyles.commentInput}
            placeholder="Leave a comment... (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          {reviewError ? (
            <Text style={cardStyles.reviewError}>{reviewError}</Text>
          ) : null}
          <Button
            size="sm"
            onPress={submitReview}
            loading={submitting}
            disabled={submitting || !customerId}
            style={{ alignSelf: "flex-start" }}
          >
            Submit rating
          </Button>
        </View>
      ) : null}

      {/* ── Expanded detail: where, and what was ordered ── */}
      {isExpanded ? (
        <View style={cardStyles.details}>
          {address || phone ? (
            <View style={cardStyles.panel}>
              <Text style={cardStyles.panelTitle}>
                {isDelivery ? "DELIVER TO" : "PICK UP FROM"}
              </Text>
              {address ? (
                <View style={cardStyles.detailRow}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={cardStyles.detailText}>{address}</Text>
                </View>
              ) : null}
              <View style={cardStyles.panelActions}>
                {address && !isDelivery ? (
                  <Pressable
                    style={cardStyles.pillBtn}
                    onPress={() => openDirections(address)}
                    accessibilityRole="link"
                  >
                    <Ionicons name="navigate-outline" size={15} color={colors.primary} />
                    <Text style={cardStyles.pillBtnText}>Directions</Text>
                  </Pressable>
                ) : null}
                {phone ? (
                  <Pressable
                    style={cardStyles.pillBtn}
                    onPress={() => callPhone(phone)}
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${phone}`}
                  >
                    <Ionicons name="call-outline" size={15} color={colors.primary} />
                    <Text style={cardStyles.pillBtnText}>{phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={cardStyles.panel}>
            <Text style={cardStyles.panelTitle}>YOUR ORDER</Text>
            {order.items?.length ? (
              order.items.map((item) => (
                <View key={getOrderItemKey(item)} style={cardStyles.lineRow}>
                  <Text style={cardStyles.lineText}>
                    {item.quantity} × {getOrderItemName(item)}
                  </Text>
                  <Text style={cardStyles.linePrice}>
                    {formatPrice(item.unit_price * item.quantity)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={cardStyles.lineRow}>
                <Text style={cardStyles.lineText}>
                  {order.quantity} × {dishName}
                </Text>
                <Text style={cardStyles.linePrice}>
                  {formatPrice(order.total_amount)}
                </Text>
              </View>
            )}
            <View style={cardStyles.totalRow}>
              <Text style={cardStyles.totalText}>
                Total
                {order.payment_method
                  ? ` · ${order.payment_method === "CASH" ? "cash" : "paid by card"}`
                  : ""}
              </Text>
              <Text style={cardStyles.totalText}>
                {formatPrice(order.total_amount)}
              </Text>
            </View>

            {requestInfo?.description ? (
              <View style={cardStyles.requestBox}>
                <Text style={cardStyles.requestText}>
                  <Text style={cardStyles.bold}>Your request: </Text>
                  {requestInfo.description}
                </Text>
              </View>
            ) : null}
            {order.special_instructions ? (
              <View
                style={[
                  cardStyles.noteBox,
                  { backgroundColor: colors.status.pending.bg },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color={colors.status.pending.fg}
                />
                <Text style={[cardStyles.noteText, { color: colors.status.pending.fg }]}>
                  <Text style={cardStyles.bold}>Your note: </Text>“
                  {order.special_instructions}”
                </Text>
              </View>
            ) : null}
            {order.order_notes ? (
              <View
                style={[
                  cardStyles.noteBox,
                  { backgroundColor: colors.status.active.bg },
                ]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={15}
                  color={colors.status.active.fg}
                />
                <Text style={[cardStyles.noteText, { color: colors.status.active.fg }]}>
                  <Text style={cardStyles.bold}>Note from {chefName}: </Text>“
                  {order.order_notes}”
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Footer: how it's handed over, and what to do now ── */}
      {!isCancelled ? (
        <View style={cardStyles.footer}>
          <View style={cardStyles.tagsRow}>
            <Tag
              icon={isDelivery ? "bicycle-outline" : "storefront-outline"}
              label={isDelivery ? "Delivery" : "Pickup"}
            />
            {order.payment_method ? (
              <Tag
                icon={order.payment_method === "CASH" ? "cash-outline" : "card-outline"}
                label={order.payment_method === "CASH" ? "Cash" : "Card"}
              />
            ) : null}
          </View>
          {order.status === "PENDING" && !order.chat_available ? (
            <Text style={cardStyles.chatHint}>
              Chat opens once the chef confirms
            </Text>
          ) : null}
          <View style={cardStyles.actionsRow}>
            {/* Chat opens the moment the chef confirms, and stays readable
                after it closes. */}
            {order.chat_available ? (
              <Pressable
                style={cardStyles.chatBtn}
                onPress={() => onOpenChat(order)}
                accessibilityRole="button"
              >
                <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
                <Text style={cardStyles.chatBtnText}>
                  {order.chat_can_send ? "Chat" : "View chat"}
                </Text>
                {unreadMessages > 0 ? (
                  <View style={cardStyles.unreadBadge}>
                    <Text style={cardStyles.unreadText}>{unreadMessages}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            {order.status === "DELIVERED" ? (
              <Button
                size="sm"
                onPress={() => onMarkReceived(order)}
                loading={isReceiving}
                disabled={isReceiving}
              >
                I received my order
              </Button>
            ) : null}
            {COMPLETED_STATUSES.has(order.status) && primaryListingId != null ? (
              <Button size="sm" onPress={() => onOrderAgain(primaryListingId)}>
                Order again
              </Button>
            ) : null}
            <Pressable
              style={cardStyles.detailsBtn}
              onPress={() => onToggle(order.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
            >
              <Text style={cardStyles.detailsBtnText}>
                {isExpanded ? "Hide details" : "Details"}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={15}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ height: spacing.md }} />
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
  containerExpanded: { borderColor: `${colors.primary}4D`, ...shadow.md },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  summary: { flex: 1, minWidth: 0 },
  dishName: { ...typography.base, fontWeight: "600", color: colors.foreground },
  mutedText: { color: colors.mutedForeground },
  metaText: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  orderId: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  priceCol: { alignItems: "flex-end", flexShrink: 0 },
  amount: { ...typography.base, fontWeight: "700", color: colors.foreground },
  amountStruck: {
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },
  itemCount: { ...typography.xs, color: colors.mutedForeground },

  strip: {
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
  },
  stripMascot: { marginVertical: -6 },
  stripTitle: { ...typography.sm, fontWeight: "700" },
  stripSub: { ...typography.xs, opacity: 0.9, marginTop: 2 },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.xs + 2,
  },
  etaText: { ...typography.xs, fontWeight: "600", color: colors.foreground },
  starsRow: { flexDirection: "row", marginTop: spacing.xs, marginLeft: -4 },
  starBtn: { padding: 4 },
  progressWrap: { marginTop: spacing.sm + 2, gap: 6 },
  progressRow: { flexDirection: "row", gap: 6 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: `${colors.foreground}1A`,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  progressLabel: { flex: 1, fontSize: 10, lineHeight: 14 },
  progressLabelCurrent: { opacity: 1, fontWeight: "700" },

  reviewBox: { marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    ...typography.sm,
    color: colors.foreground,
    backgroundColor: colors.background,
    minHeight: 64,
  },
  reviewError: { ...typography.xs, color: colors.destructive },

  details: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm + 4 },
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
    marginBottom: spacing.sm,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  detailText: { ...typography.sm, color: colors.foreground, flex: 1 },
  panelActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm + 4,
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
  },
  pillBtnText: { ...typography.sm, fontWeight: "600", color: colors.primary },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  lineText: { ...typography.sm, color: colors.foreground, flex: 1 },
  linePrice: { ...typography.sm, color: colors.foreground },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: colors.border,
    marginTop: 6,
    paddingTop: spacing.sm + 2,
  },
  totalText: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  requestBox: {
    marginTop: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  requestText: { ...typography.sm, color: colors.mutedForeground },
  bold: { fontWeight: "700" },
  noteBox: {
    marginTop: spacing.sm + 2,
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  noteText: { ...typography.sm, flex: 1 },

  footer: { padding: spacing.md, gap: spacing.sm },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { ...typography.xs, fontWeight: "600", color: colors.foreground },
  chatHint: { ...typography.xs, color: colors.mutedForeground },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
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
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
  },
  detailsBtnText: { ...typography.sm, fontWeight: "600", color: colors.primary },
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
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [orderSearch, setOrderSearch] = useState("");

  // Live unread counts behind the chat badges on each card.
  const { unread: chatUnread } = useChatUnread(Boolean(dbUser));

  // Order notifications and emails point here as ?order=<id> — there is no
  // standalone order-detail screen. Applied once, after the order actually
  // shows up in the loaded page.
  const { order: orderParam } = useLocalSearchParams<{ order?: string }>();
  const deepLinkedOrderId = Number(orderParam) || null;
  const deepLinkApplied = useRef(false);
  const listRef = useRef<FlatList<Order>>(null);

  const hasMore = orders.length < total;
  const isMounted = useRef(true);
  const hasLoadedRef = useRef(false);
  // Reviews are pre-fetched once per session so already-reviewed orders show
  // "Thanks for your review!" instead of re-prompting (prevents duplicates).
  const reviewsFetched = useRef(false);
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
            .flatMap((o) => [
              ...(o.items ?? []).map((i) => i.food_listing_id),
              o.food_listing_id,
            ])
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

        // Pre-fetch reviews once per session: seed reviewedOrderIds with every
        // order already reviewed so prior/past-session reviews don't re-prompt.
        if (!reviewsFetched.current) {
          const receivedOrders = sorted.filter((o) => o.status === "RECEIVED");
          const uniqueChefIds = [
            ...new Set(receivedOrders.map((o) => o.chef_id)),
          ];
          if (uniqueChefIds.length > 0) {
            const reviewResults = await Promise.allSettled(
              uniqueChefIds.map((cid) => reviewService.getChefReviews(Number(cid)))
            );
            const alreadyReviewed = new Set<number>();
            reviewResults.forEach((result) => {
              if (result.status === "fulfilled") {
                result.value.forEach((r) => alreadyReviewed.add(r.order_id));
              }
            });
            if (isMounted.current) {
              setReviewedOrderIds((prev) => new Set([...prev, ...alreadyReviewed]));
            }
            reviewsFetched.current = true;
          }
        }
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

  const toggleExpand = useCallback(
    (id: number) => setExpandedOrderId((prev) => (prev === id ? null : id)),
    [],
  );

  const markReceived = async (order: Order) => {
    setReceivingOrderId(order.id);
    try {
      const updated = await orderService.updateOrderStatus(order.id, "RECEIVED");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err: any) {
      Alert.alert("Error", getUserFriendlyError(err, "Failed to update order status."));
    } finally {
      setReceivingOrderId(null);
    }
  };

  const handleReviewSubmitted = useCallback((orderId: number) => {
    setReviewedOrderIds((prev) => new Set(prev).add(orderId));
  }, []);

  const dishFor = useCallback(
    (order: Order): DishInfo | undefined => {
      const primaryId = order.items?.[0]?.food_listing_id ?? order.food_listing_id;
      return primaryId != null ? dishMap.get(primaryId) : undefined;
    },
    [dishMap],
  );
  const requestFor = useCallback(
    (order: Order): RequestInfo | undefined =>
      order.food_request_id != null ? requestMap.get(order.food_request_id) : undefined,
    [requestMap],
  );

  // Search runs over every tab (of the orders loaded so far), so the pill
  // counts show where the matches are.
  const matchesSearch = useCallback(
    (order: Order): boolean => {
      const query = orderSearch.trim().toLowerCase().replace(/^#/, "");
      if (!query) return true;
      if (String(order.id).includes(query)) return true;
      const names = orderItemNames(order, dishFor(order), requestFor(order));
      return names.some((name) => name.toLowerCase().includes(query));
    },
    [orderSearch, dishFor, requestFor],
  );

  const tabOrders = useMemo(() => {
    const byTab: Record<TabType, Order[]> = {
      upcoming: [],
      "in-transit": [],
      completed: [],
      cancelled: [],
    };
    orders.forEach((o) => {
      if (matchesSearch(o)) byTab[getTabForStatus(o.status)].push(o);
    });
    return byTab;
  }, [orders, matchesSearch]);

  const displayedOrders = tabOrders[activeTab];
  const totalMatches =
    tabOrders.upcoming.length +
    tabOrders["in-transit"].length +
    tabOrders.completed.length +
    tabOrders.cancelled.length;

  // Take the deep link to its order: switch to the tab holding it, expand it,
  // and scroll it into view.
  useEffect(() => {
    if (deepLinkedOrderId === null || deepLinkApplied.current) return;
    const target = orders.find((o) => o.id === deepLinkedOrderId);
    // Not in the loaded page yet — leave the flag unset so a later page can
    // still satisfy the link.
    if (!target) return;

    deepLinkApplied.current = true;
    const targetTab = getTabForStatus(target.status);
    setOrderSearch("");
    setActiveTab(targetTab);
    setExpandedOrderId(target.id);

    // The tab switch has to render the new list before there is a row to
    // scroll to, so the index is resolved on the next frame.
    requestAnimationFrame(() => {
      const index = orders
        .filter((o) => getTabForStatus(o.status) === targetTab)
        .findIndex((o) => o.id === target.id);
      if (index >= 0) {
        listRef.current?.scrollToIndex({
          index,
          viewPosition: 0.5,
          animated: true,
        });
      }
    });
  }, [deepLinkedOrderId, orders]);

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

  const searchQuery = orderSearch.trim();
  const EMPTY_TAB: Record<TabType, { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }> = {
    upcoming: {
      icon: "time-outline",
      title: "No upcoming orders",
      sub: "Orders being prepared will appear here",
    },
    "in-transit": {
      icon: "bicycle-outline",
      title: "No orders in transit",
      sub: "Orders ready or on the way will appear here",
    },
    completed: {
      icon: "checkmark-circle-outline",
      title: "No completed orders",
      sub: "Your order history will show here",
    },
    cancelled: {
      icon: "close-outline",
      title: "No cancelled orders",
      sub: "Cancelled orders will appear here",
    },
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        {total > 0 && (
          <Text style={styles.headerSubtitle}>
            Track your orders and review past experiences
          </Text>
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.noOrders}>
          <Mascot pose="idle" size="lg" />
          <Text style={styles.errorTitle}>No orders yet</Text>
          <Text style={styles.errorSubtitle}>
            Start your culinary journey by ordering from talented home chefs in
            your area
          </Text>
          <Button onPress={() => router.push("/(tabs)/home")}>
            Explore dishes
          </Button>
        </View>
      ) : (
        <>
          {/* Tabs + search */}
          <View style={styles.controls}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {TABS.map((tab) => {
                const isActiveTab = activeTab === tab.key;
                const count = tabOrders[tab.key].length;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.tab, isActiveTab && styles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActiveTab }}
                  >
                    <Text style={isActiveTab ? styles.tabTextActive : styles.tabText}>
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.tabCountBadge,
                          isActiveTab && styles.tabCountBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabCountText,
                            isActiveTab && styles.tabCountTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order number or item"
                placeholderTextColor={colors.mutedForeground}
                value={orderSearch}
                onChangeText={setOrderSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {orderSearch ? (
                <Pressable
                  onPress={() => setOrderSearch("")}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {displayedOrders.length === 0 && searchQuery ? (
            <View style={styles.emptyTab}>
              <Ionicons name="search" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No orders match "{searchQuery}"</Text>
              <Text style={styles.emptySub}>
                {totalMatches > 0
                  ? "Nothing in this tab matches — check the other tabs above."
                  : "Try an order number, or part of the dish name."}
              </Text>
              <Button variant="outline" size="sm" onPress={() => setOrderSearch("")}>
                Clear search
              </Button>
            </View>
          ) : displayedOrders.length === 0 ? (
            <View style={styles.emptyTab}>
              <Ionicons
                name={EMPTY_TAB[activeTab].icon}
                size={40}
                color={colors.mutedForeground}
              />
              <Text style={styles.emptyTitle}>{EMPTY_TAB[activeTab].title}</Text>
              <Text style={styles.emptySub}>{EMPTY_TAB[activeTab].sub}</Text>
            </View>
          ) : (
        <FlatList
          ref={listRef}
          data={displayedOrders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          // Order cards vary in height and there is no getItemLayout, so a
          // scroll to a row that hasn't been measured yet can fail. Nudge the
          // list to the offset it does know, then retry once it has rendered.
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({
              offset: index * averageItemLength,
              animated: true,
            });
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              dish={dishFor(item)}
              requestInfo={requestFor(item)}
              chefInfo={chefMap.get(item.chef_id)}
              isExpanded={expandedOrderId === item.id}
              isReceiving={receivingOrderId === item.id}
              hasReviewed={reviewedOrderIds.has(item.id)}
              customerId={(dbUser?.id as number | undefined) ?? null}
              onToggle={toggleExpand}
              onMarkReceived={markReceived}
              onReviewSubmitted={handleReviewSubmitted}
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
                    name: toTitleCase(order.chef_name) || "the chef",
                  },
                })
              }
              onOrderAgain={(listingId) => router.push(`/dish/${listingId}`)}
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
        </>
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
  controls: {
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm + 4,
  },
  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  tabActive: { backgroundColor: colors.foreground },
  tabText: { ...typography.sm, fontWeight: "600", color: colors.mutedForeground },
  tabTextActive: { ...typography.sm, fontWeight: "700", color: colors.background },
  tabCountBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountBadgeActive: { backgroundColor: colors.background },
  tabCountText: { ...typography.xs, fontWeight: "700", color: colors.mutedForeground },
  tabCountTextActive: { color: colors.foreground },
  searchBox: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm + 4,
  },
  searchInput: {
    flex: 1,
    ...typography.base,
    color: colors.foreground,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  noOrders: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTab: {
    margin: spacing.md,
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  emptySub: {
    ...typography.sm,
    color: colors.mutedForeground,
    textAlign: "center",
    marginBottom: spacing.xs,
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
