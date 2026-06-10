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
import { FoodRequest } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

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

// ---------------------------------------------------------------------------
// Offer Modal
// ---------------------------------------------------------------------------
function OfferModal({
  visible,
  request,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  request: FoodRequest | null;
  onClose: () => void;
  onSubmit: (price: string, message: string) => void;
  submitting: boolean;
}) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

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
            <Text style={styles.modalTitle}>Make an Offer</Text>
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
              Submit Offer
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
  submittedIds,
  onMakeOffer,
}: {
  item: FoodRequest;
  submittedIds: Set<number>;
  onMakeOffer: (req: FoodRequest) => void;
}) {
  const alreadySubmitted = submittedIds.has(item.id);

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

      {alreadySubmitted ? (
        <View style={styles.offeredBadgeRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.offeredText}>Offer submitted</Text>
        </View>
      ) : (
        <Button size="sm" onPress={() => onMakeOffer(item)} style={{ marginTop: spacing.sm }}>
          Make Offer
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
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<FoodRequest | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await requestService.getOpenRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests(true);
  };

  const openOfferModal = (req: FoodRequest) => {
    setSelectedRequest(req);
    setShowModal(true);
  };

  const handleSubmitOffer = async (price: string, message: string) => {
    if (!dbUser || !selectedRequest) return;
    setSubmitting(true);
    try {
      await requestService.makeOffer(selectedRequest.id, dbUser.id, {
        price: parseFloat(price),
        message: message.trim() || undefined,
      });
      setSubmittedIds((prev) => new Set(prev).add(selectedRequest.id));
      setShowModal(false);
      setSelectedRequest(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to submit offer.");
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
            submittedIds={submittedIds}
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
        onClose={() => { setShowModal(false); setSelectedRequest(null); }}
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
  offeredBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  offeredText: { ...typography.sm, color: colors.success, fontWeight: "600" },

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
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  summaryTitle: { ...typography.base, fontWeight: "700", color: colors.foreground },
  summaryDesc: { ...typography.sm, color: colors.mutedForeground },
  summaryMeta: { ...typography.xs, color: colors.mutedForeground },
  fieldLabel: { ...typography.sm, fontWeight: "600", color: colors.foreground },
});
