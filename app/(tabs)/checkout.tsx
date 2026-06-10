import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { requestService } from "@/services/requestService";
import { userService } from "@/services/userService";
import { dishService } from "@/services/dishService";

interface OfferCheckout {
  offerId: number;
  chefId: string;
  chefName: string;
  price: number;
  message?: string;
  requestTitle: string;
}

const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    offerId?: string;
    chefId?: string;
    chefName?: string;
    price?: string;
    message?: string;
    requestTitle?: string;
  }>();

  const { items, total, clearCart } = useCart();
  const { user, dbUser } = useAuth();

  // Build offerCheckout from navigation params if present
  const offerCheckout: OfferCheckout | null =
    params.offerId
      ? {
          offerId: Number(params.offerId),
          chefId: params.chefId ?? "",
          chefName: params.chefName ?? "",
          price: Number(params.price ?? 0),
          message: params.message,
          requestTitle: params.requestTitle ?? "",
        }
      : null;
  const isOfferMode = offerCheckout !== null;
  const checkoutTotal = isOfferMode ? offerCheckout!.price : total;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [isPickupLoading, setIsPickupLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [etaText, setEtaText] = useState<string | null>(null);

  // Pre-fill name and phone from dbUser
  useEffect(() => {
    if (dbUser?.name) setFullName(dbUser.name);
    else if (user?.displayName) setFullName(user.displayName);
    if (dbUser?.phone) setPhone(dbUser.phone);
  }, [dbUser, user?.displayName]);

  // Fetch ETA estimate for cart items (not offer mode)
  useEffect(() => {
    if (isOfferMode || items.length === 0) return;
    const listingIds = [...new Set(items.map((i) => parseInt(i.id, 10)).filter((n) => !isNaN(n)))];
    Promise.allSettled(listingIds.map((id) => dishService.getListingEta(id))).then(
      (results) => {
        let maxMinutes = 0;
        let minMinutes = 0;
        results.forEach((r) => {
          if (r.status === "fulfilled") {
            maxMinutes = Math.max(maxMinutes, r.value.tentative_eta_max_minutes);
            minMinutes = minMinutes === 0
              ? r.value.tentative_eta_min_minutes
              : Math.max(minMinutes, r.value.tentative_eta_min_minutes);
          }
        });
        if (maxMinutes > 0) {
          setEtaText(
            minMinutes && minMinutes !== maxMinutes
              ? `${minMinutes}–${maxMinutes} min`
              : `~${maxMinutes} min`
          );
        }
      }
    );
  }, [isOfferMode, items]);

  // Load chef pickup address
  useEffect(() => {
    const chefId = isOfferMode
      ? offerCheckout!.chefId
      : items[0]?.chefId;

    if (!chefId) {
      setPickupAddress("");
      return;
    }

    let cancelled = false;
    setIsPickupLoading(true);

    userService.getUserById(chefId).then((chef) => {
      if (cancelled) return;
      const address =
        chef.locations?.find((l) => l.is_primary)?.address ??
        chef.locations?.[0]?.address ??
        "";
      setPickupAddress(address);
    }).catch(() => {
      if (!cancelled) setPickupAddress("");
    }).finally(() => {
      if (!cancelled) setIsPickupLoading(false);
    });

    return () => { cancelled = true; };
  }, [isOfferMode, offerCheckout?.chefId, items]);

  // If cart is empty and not offer mode, redirect back (must be in effect, not during render)
  useEffect(() => {
    if (!isOfferMode && items.length === 0) {
      router.replace("/(tabs)/cart");
    }
  }, [isOfferMode, items.length]);

  // If not logged in, show sign in prompt
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.unauthContainer}>
          <Ionicons name="lock-closed-outline" size={56} color={colors.mutedForeground} />
          <Text style={styles.unauthTitle}>Sign in to continue</Text>
          <Text style={styles.unauthSubtitle}>
            You need to be signed in to place an order.
          </Text>
          <Button
            variant="primary"
            size="lg"
            style={styles.unauthButton}
            onPress={() => router.push("/(auth)/customer-login")}
          >
            Sign In
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Render nothing while the effect above redirects
  if (!isOfferMode && items.length === 0) return null;

  const handlePlaceOrder = async () => {
    if (!fullName.trim()) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Missing Info", "Please enter a phone number.");
      return;
    }
    if (!pickupAddress) {
      Alert.alert("No Address", "Pickup address is unavailable for this chef.");
      return;
    }
    if (!dbUser) {
      Alert.alert("Profile Loading", "Profile is still loading, please wait.");
      return;
    }

    if (!isOfferMode) {
      const uniqueChefs = new Set(items.map((i) => i.chefId));
      if (uniqueChefs.size > 1) {
        Alert.alert(
          "Multiple Chefs",
          "Your cart has items from multiple chefs. Please order from one chef at a time."
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const createdOrderIds: number[] = [];

      if (isOfferMode) {
        const order = await requestService.acceptOffer(offerCheckout!.offerId);
        await orderService.payOrder(order.id, { method: "CASH" });
        createdOrderIds.push(order.id);
      } else {
        const chefId = items[0].chefId;
        for (const item of items) {
          const foodListingId = parseInt(item.id, 10);
          if (isNaN(foodListingId)) {
            throw new Error(`Invalid food listing ID: ${item.id}`);
          }
          const order = await orderService.createOrder({
            quantity: item.quantity,
            total_amount: item.price * item.quantity,
            customer_id: user.id,
            chef_id: chefId,
            food_listing_id: foodListingId,
            delivery_address: pickupAddress,
            delivery_phone: phone.trim(),
            special_instructions: instructions.trim() || undefined,
          });
          await orderService.payOrder(order.id, { method: "CASH" });
          createdOrderIds.push(order.id);
        }
        clearCart();
      }

      router.replace("/(tabs)/order-success");
    } catch (err: any) {
      Alert.alert("Order Failed", err?.message ?? "Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>

          <View style={styles.chefBanner}>
            <Ionicons name="restaurant-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.chefBannerText}>
              {"Order from "}
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                {isOfferMode ? offerCheckout!.chefName : items[0]?.chefName}
              </Text>
            </Text>
          </View>

          {isOfferMode ? (
            <View style={styles.offerCard}>
              <Text style={styles.offerTitle}>{offerCheckout!.requestTitle}</Text>
              {offerCheckout!.message ? (
                <Text style={styles.offerMessage}>"{offerCheckout!.message}"</Text>
              ) : null}
              <Text style={styles.offerPrice}>
                Chef's offer: {formatPrice(offerCheckout!.price)}
              </Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>
                    {item.name} × {item.quantity}
                  </Text>
                  <Text style={styles.summaryItemPrice}>
                    {formatPrice(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(checkoutTotal)}</Text>
          </View>
          {etaText ? (
            <View style={styles.etaBanner}>
              <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.etaBannerText}>
                Estimated ready in{" "}
                <Text style={{ fontWeight: "600", color: colors.foreground }}>{etaText}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>

          <Input
            label="Full Name *"
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            autoCapitalize="words"
          />

          <Input
            label="Phone Number *"
            placeholder="Enter phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <View style={styles.textAreaContainer}>
            <Text style={styles.textAreaLabel}>Special Instructions (Optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Any notes for the chef about your order?"
              placeholderTextColor={colors.mutedForeground}
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Pickup Location */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Pickup Location</Text>
          </View>

          <View style={styles.addressBox}>
            {isPickupLoading ? (
              <View style={styles.addressLoading}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
                <Text style={styles.addressLoadingText}>Loading chef address…</Text>
              </View>
            ) : pickupAddress ? (
              <View style={styles.addressRow}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.addressText}>{pickupAddress}</Text>
              </View>
            ) : (
              <Text style={styles.addressUnavailable}>
                Pickup address is unavailable for this chef.
              </Text>
            )}
          </View>
          <Text style={styles.pickupNote}>
            Please collect your order from this chef location.
          </Text>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4</Text>
            </View>
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Payment</Text>
          </View>

          <View style={styles.paymentOption}>
            <Ionicons name="cash" size={22} color={colors.primary} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Cash on Pickup</Text>
              <Text style={styles.paymentSubtitle}>Pay when you collect your order</Text>
            </View>
            <View style={styles.paymentCheck}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            </View>
          </View>
        </View>

        {/* Place Order Button */}
        <Button
          variant="primary"
          size="lg"
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Placing Order…" : `Place Order — ${formatPrice(checkoutTotal)}`}
        </Button>

        <Text style={styles.termsText}>
          By placing this order, you agree to our terms and confirm you can pick up from the listed location.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.sm,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
  },
  chefBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chefBannerText: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  offerCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  offerTitle: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  offerMessage: {
    ...typography.sm,
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  offerPrice: {
    ...typography.base,
    fontWeight: "700",
    color: colors.primary,
  },
  itemsList: {
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItemName: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryItemPrice: {
    ...typography.sm,
    fontWeight: "500",
    color: colors.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    ...typography.md,
    fontWeight: "700",
    color: colors.foreground,
  },
  totalValue: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.primary,
  },
  etaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  etaBannerText: {
    ...typography.xs,
    color: colors.mutedForeground,
    flex: 1,
  },
  textAreaContainer: {
    gap: 6,
  },
  textAreaLabel: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.foreground,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    ...typography.base,
    color: colors.foreground,
    backgroundColor: colors.surface,
    minHeight: 80,
  },
  addressBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
    justifyContent: "center",
  },
  addressLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  addressLoadingText: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  addressText: {
    ...typography.base,
    color: colors.foreground,
    flex: 1,
  },
  addressUnavailable: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  pickupNote: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}0D`,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  paymentSubtitle: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  paymentCheck: {
    marginLeft: "auto",
  },
  placeOrderButton: {
    width: "100%",
    marginTop: spacing.sm,
  },
  termsText: {
    ...typography.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  unauthTitle: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  unauthSubtitle: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  unauthButton: {
    minWidth: 160,
    marginTop: spacing.sm,
  },
});
