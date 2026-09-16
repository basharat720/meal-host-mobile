import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { requestService } from "@/services/requestService";
import { FoodRequest, Offer } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useI18n } from "@/i18n/context";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { getUserFriendlyError } from "@/lib/errorMessages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (iso?: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// ---------------------------------------------------------------------------
// Offer Modal
// ---------------------------------------------------------------------------
function OfferModal({
  visible,
  request,
  rejectedOffers,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  request: FoodRequest | null;
  rejectedOffers: Offer[];
  onClose: () => void;
  onSubmit: (price: string, message: string) => void;
  submitting: boolean;
}) {
  const { formatPrice } = useI18n();
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const isRevising = rejectedOffers.length > 0;

  const handleSubmit = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) {
      Alert.alert("Validation", "Please enter a valid price greater than 0.");
      return;
    }
    onSubmit(price, message);
  };

  const handleClose = () => {
    setPrice("");
    setMessage("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isRevising ? "Revise Offer" : "Make an Offer"}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {request && (
              <View style={styles.requestSummary}>
                <Text style={styles.summaryTitle}>{request.title}</Text>
                {request.description ? (
                  <Text style={styles.summaryDesc}>{request.description}</Text>
                ) : null}
                {request.event_time ? (
                  <Text style={styles.summaryMeta}>
                    Event: {formatDateTime(request.event_time)}
                  </Text>
                ) : null}
              </View>
            )}

            {isRevising ? (
              <View style={styles.declinedSection}>
                <View style={styles.declinedHeaderRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                  <Text style={styles.declinedHeaderText}>Previous Declined Offers</Text>
                </View>
                {rejectedOffers.map((offer) => (
                  <View key={offer.id} style={styles.declinedCard}>
                    <View style={styles.declinedTopRow}>
                      <Text style={styles.declinedPrice}>{formatPrice(offer.price)}</Text>
                      <Text style={styles.declinedDate}>{formatShortDate(offer.created_at)}</Text>
                    </View>
                    {offer.message ? (
                      <Text style={styles.declinedMessage}>Your message: "{offer.message}"</Text>
                    ) : null}
                    {offer.rejection_reason ? (
                      <View style={styles.rejectionBox}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.destructive} style={{ marginTop: 2 }} />
                        <Text style={styles.rejectionText}>"{offer.rejection_reason}"</Text>
                      </View>
                    ) : (
                      <Text style={styles.declinedNoReason}>No reason provided.</Text>
                    )}
                  </View>
                ))}
                <Text style={styles.reviseHint}>Submit a revised offer below:</Text>
              </View>
            ) : null}

            <Input
              label="Your Price ($) *"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />

            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Message (optional)</Text>
              <Input
                placeholder="Tell the customer about your offer…"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleClose} style={{ flex: 1 }} disabled={submitting}>
              Cancel
            </Button>
            <Button onPress={handleSubmit} style={{ flex: 1 }} loading={submitting}>
              {isRevising ? "Submit Revised Offer" : "Submit Offer"}
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Request Card
// ---------------------------------------------------------------------------
function RequestCard({
  item,
  offers,
  loadingOffers,
  onMakeOffer,
}: {
  item: FoodRequest;
  offers: Offer[] | undefined;
  loadingOffers: boolean;
  onMakeOffer: (req: FoodRequest, rejectedOffers: Offer[]) => void;
}) {
  const { formatPrice } = useI18n();

  const myOffers = offers ?? [];
  const pendingOffer = myOffers.find((o) => o.status === "PENDING");
  const rejectedOffers = myOffers.filter((o) => o.status === "REJECTED");

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.status === "OPEN" ? (
          <Badge label="Open" variant="success" />
        ) : (
          <Badge label={item.status} variant="outline" />
        )}
      </View>

      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
        <Text style={styles.metaText}>
          Requested: {formatDateTime(item.created_at)}
        </Text>
      </View>

      {item.event_time ? (
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.metaText}>Event: {formatDateTime(item.event_time)}</Text>
        </View>
      ) : null}

      {item.dietary_tags?.length > 0 ? (
        <View style={styles.tagsRow}>
          {item.dietary_tags.map((t) => (
            <Badge key={t.id} label={t.code} variant="outline" />
          ))}
        </View>
      ) : null}

      {/* Previous declined offers (shown inline once the chef has been rejected) */}
      {rejectedOffers.length > 0 ? (
        <View style={styles.declinedSection}>
          <View style={styles.declinedHeaderRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
            <Text style={styles.declinedHeaderText}>Previous Declined Offers</Text>
          </View>
          {rejectedOffers.map((offer) => (
            <View key={offer.id} style={styles.declinedCard}>
              <View style={styles.declinedTopRow}>
                <Text style={styles.declinedPrice}>{formatPrice(offer.price)}</Text>
                <Text style={styles.declinedDate}>{formatShortDate(offer.created_at)}</Text>
              </View>
              {offer.message ? (
                <Text style={styles.declinedMessage}>Your message: "{offer.message}"</Text>
              ) : null}
              {offer.rejection_reason ? (
                <View style={styles.rejectionBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.destructive} style={{ marginTop: 2 }} />
                  <Text style={styles.rejectionText}>"{offer.rejection_reason}"</Text>
                </View>
              ) : (
                <Text style={styles.declinedNoReason}>No reason provided.</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {/* CTA / status area */}
      {loadingOffers && !offers ? (
        <View style={styles.offersLoadingRow}>
          <Ionicons name="hourglass-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.metaText}>Loading your offers…</Text>
        </View>
      ) : pendingOffer ? (
        <View style={styles.awaitingBox}>
          <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.awaitingTitle}>Awaiting customer response</Text>
            <Text style={styles.awaitingDetail}>
              You offered <Text style={styles.awaitingPrice}>{formatPrice(pendingOffer.price)}</Text>
              {pendingOffer.message ? ` — "${pendingOffer.message}"` : ""}
            </Text>
          </View>
        </View>
      ) : (
        <Button
          size="sm"
          onPress={() => onMakeOffer(item, rejectedOffers)}
          style={{ marginTop: spacing.sm }}
        >
          {rejectedOffers.length > 0 ? "Revise Offer" : "Make Offer"}
        </Button>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function ChefRequestsScreen() {
  const { dbUser } = useAuth();
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Server-derived offers keyed by request id (survives reload/refresh).
  const [offersMap, setOffersMap] = useState<Map<number, Offer[]>>(new Map());
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FoodRequest | null>(null);
  const [selectedRejected, setSelectedRejected] = useState<Offer[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Load the chef's existing offers for each open request so UI state is
  // derived from the server rather than an in-session set that resets on reload.
  const fetchOffers = useCallback(
    async (list: FoodRequest[]) => {
      if (!dbUser) return;
      setLoadingOffers(true);
      try {
        const results = await Promise.all(
          list.map(async (req) => {
            try {
              const all = await requestService.getRequestOffers(req.id);
              const mine = (Array.isArray(all) ? all : []).filter(
                (o) => o.chef_id === dbUser.id
              );
              return [req.id, mine] as const;
            } catch (err) {
              console.error(`Failed to fetch offers for request ${req.id}:`, err);
              return [req.id, [] as Offer[]] as const;
            }
          })
        );
        setOffersMap(new Map(results));
      } finally {
        setLoadingOffers(false);
      }
    },
    [dbUser]
  );

  const fetchRequests = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await requestService.getOpenRequests();
        const list = Array.isArray(data) ? data : [];
        setRequests(list);
        await fetchOffers(list);
      } catch (err) {
        console.error("Failed to fetch requests:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchOffers]
  );

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests(true);
  };

  const openOfferModal = (req: FoodRequest, rejectedOffers: Offer[]) => {
    setSelectedRequest(req);
    setSelectedRejected(rejectedOffers);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
    setSelectedRejected([]);
  };

  const handleSubmitOffer = async (price: string, message: string) => {
    if (!dbUser || !selectedRequest) return;
    const requestId = selectedRequest.id;
    setSubmitting(true);
    try {
      const offer = await requestService.makeOffer(requestId, dbUser.id, {
        price: parseFloat(price),
        message: message.trim() || undefined,
      });
      // Update local server-derived state so the "Awaiting customer response"
      // state shows immediately (and refetch to stay in sync).
      setOffersMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(requestId) ?? [];
        next.set(requestId, [...existing, offer]);
        return next;
      });
      closeModal();
      // Refresh offers from the server in the background.
      requestService
        .getRequestOffers(requestId)
        .then((all) => {
          const mine = (Array.isArray(all) ? all : []).filter(
            (o) => o.chef_id === dbUser.id
          );
          setOffersMap((prev) => {
            const next = new Map(prev);
            next.set(requestId, mine);
            return next;
          });
        })
        .catch((err) => console.error("Failed to refresh offers:", err));
    } catch (err: any) {
      Alert.alert("Error", getUserFriendlyError(err, "Failed to submit offer."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading requests…" />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Food Requests</Text>
        <Pressable onPress={onRefresh} hitSlop={8}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id.toString()}
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            offers={offersMap.get(item.id)}
            loadingOffers={loadingOffers}
            onMakeOffer={openOfferModal}
          />
        )}
        contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No open requests"
            description="Customer food requests will appear here when available."
          />
        }
      />

      <OfferModal
        visible={showModal}
        request={selectedRequest}
        rejectedOffers={selectedRejected}
        onClose={closeModal}
        onSubmit={handleSubmitOffer}
        submitting={submitting}
      />
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

  listContent: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: "center" },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
    gap: spacing.xs,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitle: { ...typography.base, fontWeight: "700", color: colors.foreground, flex: 1 },
  cardDesc: { ...typography.sm, color: colors.mutedForeground },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { ...typography.xs, color: colors.mutedForeground },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },

  offersLoadingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },

  // Awaiting-response (pending) state
  awaitingBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    marginTop: spacing.sm,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  awaitingTitle: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  awaitingDetail: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  awaitingPrice: { fontWeight: "700", color: colors.foreground },

  // Previous declined offers
  declinedSection: { marginTop: spacing.sm, gap: spacing.xs },
  declinedHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  declinedHeaderText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  declinedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  declinedTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  declinedPrice: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  declinedDate: { ...typography.xs, color: colors.mutedForeground },
  declinedMessage: { ...typography.xs, color: colors.mutedForeground, fontStyle: "italic" },
  declinedNoReason: { ...typography.xs, color: colors.mutedForeground, fontStyle: "italic" },
  rejectionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rejectionText: { ...typography.xs, color: colors.destructive, flex: 1 },
  reviseHint: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },

  // Offer Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.xl, fontWeight: "700", color: colors.foreground },
  modalBody: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  modalFooter: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  requestSummary: {
    backgroundColor: colors.lightSage,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  summaryTitle: { ...typography.base, fontWeight: "700", color: colors.foreground },
  summaryDesc: { ...typography.sm, color: colors.mutedForeground },
  summaryMeta: { ...typography.xs, color: colors.mutedForeground },
  fieldLabel: { ...typography.sm, fontWeight: "600", color: colors.foreground },
});
