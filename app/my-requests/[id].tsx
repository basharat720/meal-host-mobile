import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { requestService, userService } from "@/services/api";
import { FoodRequest, Offer } from "@/services/types";
import { colors, spacing, typography, radius, shadow } from "@/constants/theme";

function offerBadgeVariant(
  status: Offer["status"]
): "warning" | "success" | "default" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "ACCEPTED":
      return "success";
    case "REJECTED":
      return "default";
    default:
      return "default";
  }
}

export default function RequestDetailScreen() {
  const { id, request: requestParam } = useLocalSearchParams<{ id: string; request?: string }>();
  const { dbUser } = useAuth();
  const { formatPrice } = useI18n();

  const requestId = Number(id);

  // Use pre-loaded request data passed from the list screen.
  // The backend has no GET /requests/{id} endpoint, so we rely on the passed data.
  const initialRequest = requestParam ? (JSON.parse(requestParam as string) as FoodRequest) : null;
  const [request, setRequest] = useState<FoodRequest | null>(initialRequest);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [chefNames, setChefNames] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Reject flow state
  const [pendingRejectOfferId, setPendingRejectOfferId] = useState<
    number | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const loadData = useCallback(
    async (showFullLoader = true) => {
      if (showFullLoader) {
        setIsLoading(true);
        setFetchError(null);
      }
      try {
        // Fetch offers (the list screen passes request data, so no GET /requests/{id} call needed)
        const offersData = await requestService.getRequestOffers(requestId);
        setOffers(offersData);

        // Fetch chef names
        const uniqueChefIds = [...new Set(offersData.map((o) => o.chef_id))];
        const results = await Promise.allSettled(
          uniqueChefIds.map((cid) => userService.getUserById(cid.toString()))
        );
        const map = new Map<number, string>();
        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            map.set(
              uniqueChefIds[i],
              result.value.name ?? `Chef #${uniqueChefIds[i]}`
            );
          } else {
            map.set(uniqueChefIds[i], `Chef #${uniqueChefIds[i]}`);
          }
        });
        setChefNames(map);
      } catch {
        setFetchError("Couldn't load the request details. Please try again.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(false);
  }, [loadData]);

  const handleAccept = (offer: Offer) => {
    const chefName = chefNames.get(offer.chef_id) ?? `Chef #${offer.chef_id}`;
    Alert.alert(
      "Accept Offer",
      `Accept ${chefName}'s offer for ${formatPrice(offer.price)}? You'll pay at pickup.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue to Checkout",
          style: "default",
          onPress: () => {
            router.push({
              pathname: "/(tabs)/checkout",
              params: {
                offerId: offer.id.toString(),
                chefId: offer.chef_id.toString(),
                chefName,
                price: offer.price.toString(),
                message: offer.message ?? "",
                requestTitle: request?.title ?? "Food Request",
              },
            });
          },
        },
      ]
    );
  };

  const handleRejectConfirm = async (offer: Offer) => {
    setIsRejecting(true);
    try {
      const updated = await requestService.rejectOffer(
        offer.id,
        rejectReason.trim() || undefined
      );
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? updated : o)));
      setPendingRejectOfferId(null);
      setRejectReason("");
      Alert.alert("Offer declined.", "The chef's offer has been declined.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to decline the offer.");
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return <FullScreenLoader message="Loading request details..." />;
  }

  if (fetchError && !request) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={styles.navTitle}>Request Detail</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.destructive}
          />
          <Text style={styles.errorText}>{fetchError}</Text>
          <Button onPress={() => loadData()} style={styles.retryBtn}>
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const hasAcceptedOffer = offers.some((o) => o.status === "ACCEPTED");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Navigation header */}
      <View style={styles.navHeader}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          Request Detail
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Request header card */}
        {request && (
          <Card style={styles.requestCard}>
            <View style={styles.requestTitleRow}>
              <Text style={styles.requestTitle}>{request.title}</Text>
              <Badge
                label={request.status}
                variant={request.status === "OPEN" ? "success" : "default"}
              />
            </View>
            {request.description ? (
              <Text style={styles.requestDesc}>{request.description}</Text>
            ) : null}
            {request.event_time ? (
              <View style={styles.eventTimeRow}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
                <Text style={styles.eventTimeText}>
                  {new Date(request.event_time).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ) : null}
            {request.dietary_tags.length > 0 && (
              <View style={styles.tagsRow}>
                {request.dietary_tags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag.code}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Offers section header */}
        <Text style={styles.sectionTitle}>
          {offers.length === 0
            ? "No offers yet"
            : `${offers.length} Offer${offers.length > 1 ? "s" : ""}`}
        </Text>

        {/* Info banner: request still open */}
        {request?.status === "OPEN" &&
          offers.length > 0 &&
          !hasAcceptedOffer && (
            <View style={styles.infoBanner}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.primary}
                style={styles.infoIcon}
              />
              <Text style={styles.infoText}>
                Your request is still open — more chefs may send you offers.
              </Text>
            </View>
          )}

        {/* Offers list */}
        {offers.length === 0 ? (
          <View style={styles.emptyOffers}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={styles.emptyOffersText}>
              No offers yet — chefs will respond soon.
            </Text>
          </View>
        ) : (
          <View style={styles.offersList}>
            {offers.map((offer) => {
              const chefName =
                chefNames.get(offer.chef_id) ?? `Chef #${offer.chef_id}`;
              const isPending = offer.status === "PENDING";
              const isAccepted = offer.status === "ACCEPTED";
              const isRejected = offer.status === "REJECTED";
              const canAct = request?.status === "OPEN" && isPending;
              const isThisRejectPending =
                pendingRejectOfferId === offer.id;

              return (
                <View
                  key={offer.id}
                  style={[
                    styles.offerCard,
                    isAccepted && styles.offerCardAccepted,
                    isRejected && styles.offerCardRejected,
                  ]}
                >
                  {/* Offer header */}
                  <View style={styles.offerHeader}>
                    <View style={styles.offerChefInfo}>
                      <Text
                        style={[
                          styles.chefName,
                          isRejected && styles.textMuted,
                        ]}
                      >
                        {chefName}
                      </Text>
                      <Text style={styles.offerDate}>
                        {new Date(offer.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View style={styles.offerPriceArea}>
                      <Text
                        style={[
                          styles.offerPrice,
                          isRejected && styles.offerPriceRejected,
                        ]}
                      >
                        {formatPrice(offer.price)}
                      </Text>
                      <Badge
                        label={offer.status}
                        variant={offerBadgeVariant(offer.status)}
                      />
                    </View>
                  </View>

                  {/* Offer message */}
                  {offer.message ? (
                    <Text style={styles.offerMessage}>{offer.message}</Text>
                  ) : null}

                  {/* Accepted state */}
                  {isAccepted && (
                    <View style={styles.statusRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.success}
                      />
                      <Text style={styles.acceptedText}>
                        You accepted this offer
                      </Text>
                    </View>
                  )}

                  {/* Rejected state */}
                  {isRejected && (
                    <View>
                      <View style={styles.statusRow}>
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={colors.destructive}
                        />
                        <Text style={styles.rejectedText}>
                          You declined this offer
                        </Text>
                      </View>
                      {offer.rejection_reason ? (
                        <Text style={styles.rejectionReason}>
                          Reason: "{offer.rejection_reason}"
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Action buttons */}
                  {canAct && !isThisRejectPending && (
                    <View style={styles.actionRow}>
                      <Button
                        size="sm"
                        onPress={() => handleAccept(offer)}
                        style={styles.acceptBtn}
                      >
                        Accept Offer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setPendingRejectOfferId(offer.id);
                          setRejectReason("");
                        }}
                        style={styles.rejectBtn}
                        textStyle={styles.rejectBtnText}
                      >
                        Decline
                      </Button>
                    </View>
                  )}

                  {/* Reject reason input */}
                  {canAct && isThisRejectPending && (
                    <View style={styles.rejectReasonContainer}>
                      <TextInput
                        style={styles.rejectReasonInput}
                        placeholder="Reason for declining (optional)"
                        placeholderTextColor={colors.mutedForeground}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        multiline
                        numberOfLines={2}
                        maxLength={300}
                        textAlignVertical="top"
                      />
                      <View style={styles.rejectConfirmRow}>
                        <Button
                          size="sm"
                          variant="destructive"
                          loading={isRejecting}
                          onPress={() => handleRejectConfirm(offer)}
                          style={styles.confirmRejectBtn}
                        >
                          Confirm Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isRejecting}
                          onPress={() => {
                            setPendingRejectOfferId(null);
                            setRejectReason("");
                          }}
                        >
                          Cancel
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  navTitle: {
    flex: 1,
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },

  content: {
    padding: spacing.md,
    paddingBottom: spacing["2xl"],
  },

  // Request card
  requestCard: { marginBottom: spacing.md },
  requestTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  requestTitle: {
    flex: 1,
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  requestDesc: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  eventTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm,
  },
  eventTimeText: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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

  // Section
  sectionTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },

  // Info banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  infoIcon: { marginRight: spacing.xs, marginTop: 1 },
  infoText: {
    flex: 1,
    ...typography.sm,
    color: colors.primary,
  },

  // Empty offers
  emptyOffers: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyOffersText: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
  },

  // Offers list
  offersList: { gap: spacing.sm },
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.sm,
  },
  offerCardAccepted: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  offerCardRejected: {
    borderColor: colors.destructive + "33",
    backgroundColor: colors.muted,
  },

  offerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  offerChefInfo: { flex: 1 },
  chefName: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  textMuted: { color: colors.mutedForeground },
  offerDate: {
    ...typography.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  offerPriceArea: {
    alignItems: "flex-end",
    gap: 4,
  },
  offerPrice: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.primary,
  },
  offerPriceRejected: {
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },

  offerMessage: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },

  // Status rows
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  acceptedText: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.success,
  },
  rejectedText: {
    ...typography.sm,
    color: colors.destructive,
  },
  rejectionReason: {
    ...typography.xs,
    color: colors.mutedForeground,
    fontStyle: "italic",
    marginLeft: 22,
    marginTop: 2,
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptBtn: { flex: 1 },
  rejectBtn: {
    flex: 1,
    borderColor: colors.destructive,
  },
  rejectBtnText: { color: colors.destructive },

  // Reject reason
  rejectReasonContainer: { marginTop: spacing.sm },
  rejectReasonInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.sm,
    color: colors.foreground,
    backgroundColor: colors.surface,
    minHeight: 64,
    marginBottom: spacing.sm,
  },
  rejectConfirmRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  confirmRejectBtn: { flex: 1 },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  retryBtn: { minWidth: 120 },
});
