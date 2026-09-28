import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/contexts/CartContext";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { isWithinServiceArea } from "@/services/serviceAreaService";
import { useDeliveryAvailability } from "@/hooks/useDeliveryAvailability";
import { useServiceAreaGate } from "@/hooks/useServiceAreaGate";
import { LocationRequiredCard } from "@/components/location/LocationRequiredCard";
import { validatePhoneNumber } from "@/lib/phone";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";
import { getCheckoutError } from "@/lib/errorMessages";
import { orderService } from "@/services/orderService";
import type { OrderCreate } from "@/services/types";
import { requestService } from "@/services/requestService";
import { userService } from "@/services/userService";
import { dishService } from "@/services/dishService";
import * as Location from "expo-location";
import { formatDuration, formatDurationRange } from "@/lib/duration";
import { calculateDistance, maskAddressEnhanced } from "@/lib/addressPrivacy";

interface OfferCheckout {
  offerId: number;
  chefId: string;
  chefName: string;
  price: number;
  message?: string;
  requestTitle: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { formatPrice } = useI18n();
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
  const [distanceToChef, setDistanceToChef] = useState<number | undefined>(undefined);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  // Coordinates behind the delivery address, so the zone rule can be checked
  // against where the food is actually going.
  const [deliveryCoords, setDeliveryCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [etaText, setEtaText] = useState<string | null>(null);
  const orderPlacedRef = useRef(false);

  // Where the customer is. Reads a position we already have permission for and
  // otherwise waits to be asked — mounting never raises the system prompt.
  // Nothing here blocks an order; it only feeds the delivery question below.
  // See feature-docs/07-ordering-zone-in-the-app.md.
  const gate = useServiceAreaGate();
  const areaName = gate.area?.name ?? "our launch area";

  // The dishes being checked out. Offer orders have no listing, and the server
  // always makes those pickup.
  const checkoutListingIds = useMemo(
    () =>
      isOfferMode
        ? []
        : items.map((item) => Number(item.id)).filter((id) => !isNaN(id)),
    [isOfferMode, items]
  );

  // Delivery needs BOTH the customer and the kitchen inside the zone, and the
  // kitchen's exact coordinates are deliberately never published, so only the
  // server can answer this.
  const delivery = useDeliveryAvailability({
    enabled: !isOfferMode && checkoutListingIds.length > 0,
    listingIds: checkoutListingIds,
    chefId: items[0] ? Number(items[0].chefId) : undefined,
    locationPayload: gate.orderLocationPayload,
  });
  const isDeliveryAvailable = delivery.deliveryAvailable === true;

  // The delivery point has to sit inside the zone too. Checked on the device
  // because the address the customer picks is not the position the gate holds
  // until they pick it; the server re-checks regardless.
  const isDeliveryOutsideArea =
    deliveryType === "delivery" &&
    deliveryCoords !== null &&
    !isWithinServiceArea(gate.area, deliveryCoords.lat, deliveryCoords.lon);

  // Never leave Delivery selected once we learn it isn't on offer — the
  // customer would otherwise fill in an address the order would be refused for.
  useEffect(() => {
    if (deliveryType === "delivery" && delivery.deliveryAvailable === false) {
      setDeliveryType("pickup");
    }
  }, [deliveryType, delivery.deliveryAvailable]);

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
              ? formatDurationRange(minMinutes, maxMinutes)
              : `~${formatDuration(maxMinutes)}`
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

    userService.getUserById(chefId).then(async (chef) => {
      if (cancelled) return;
      const primary = chef.locations?.find((l) => l.is_primary) ?? chef.locations?.[0];
      setPickupAddress(primary?.address ?? "");

      // Distance is a nice-to-have beside the masked area, so this must never
      // prompt: only read the position if the user has already granted access
      // (for the dish feed's location filter). Unlike the web app, asking here
      // would put a system permission dialog in the middle of checkout.
      if (primary?.latitude == null || primary?.longitude == null) return;
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setDistanceToChef(
          calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            primary.latitude,
            primary.longitude
          )
        );
      } catch {
        // Non-fatal: the area is still shown, just without a distance.
      }
    }).catch(() => {
      if (!cancelled) {
        setPickupAddress("");
        setDistanceToChef(undefined);
      }
    }).finally(() => {
      if (!cancelled) setIsPickupLoading(false);
    });

    return () => { cancelled = true; };
  }, [isOfferMode, offerCheckout?.chefId, items]);

  // If cart is empty and not offer mode, redirect back (must be in effect, not during render)
  useEffect(() => {
    if (!isOfferMode && items.length === 0 && !orderPlacedRef.current) {
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
            onPress={() =>
              router.push({
                pathname: "/(auth)/customer-login",
                params: { redirect: "/(tabs)/checkout" },
              })
            }
          >
            Sign In
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Render nothing while the effect above redirects
  if (!isOfferMode && items.length === 0) return null;

  const openLink = (path: string) => router.push(path as Href);

  const handlePlaceOrder = async () => {
    if (!fullName.trim()) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }
    const phoneResult = validatePhoneNumber(phone, true);
    if (!phoneResult.isValid) {
      Alert.alert("Missing Info", phoneResult.error!);
      return;
    }
    if (deliveryType === "pickup" && !pickupAddress) {
      Alert.alert("No Address", "Pickup address is unavailable for this chef.");
      return;
    }
    if (deliveryType === "delivery" && !deliveryAddress.trim()) {
      Alert.alert(
        "Missing Info",
        "Please use “Locate me” to set your delivery address."
      );
      return;
    }
    // Location never blocks an order — it only decides whether delivery was an
    // option. A delivery order that slipped past the UI is caught here so the
    // customer is told before paying rather than by a server refusal.
    if (deliveryType === "delivery" && !isDeliveryAvailable) {
      setDeliveryType("pickup");
      Alert.alert(
        "Switched to pickup",
        delivery.message ??
          `We can't deliver this order. FoodPal currently delivers in ${areaName} only — your order has been switched to pickup.`
      );
      return;
    }
    if (isDeliveryOutsideArea) {
      Alert.alert(
        "Outside our delivery zone",
        `That delivery address is outside our zone. FoodPal currently delivers in ${areaName} only. Locate yourself from an address inside the zone, or switch to pickup.`
      );
      return;
    }
    if (!acceptedTerms) {
      Alert.alert(
        "Accept Terms",
        "Please agree to the Terms & Conditions and Refund Policy to place your order."
      );
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
        // Accepting an offer creates a real order, so it carries the confirmed
        // position the same way a cart order does.
        const order = await requestService.acceptOffer(
          offerCheckout!.offerId,
          gate.orderLocationPayload
        );
        await orderService.payOrder(order.id, { method: "CASH" });
        createdOrderIds.push(order.id);
      } else {
        // The cart is restricted to one kitchen, so it becomes ONE order
        // carrying one line per dish — not an order per dish.
        const chefId = items[0].chefId;
        const finalAddress =
          deliveryType === "delivery" ? deliveryAddress.trim() : pickupAddress;
        const orderLines = items.map((item) => {
          const foodListingId = parseInt(item.id, 10);
          if (isNaN(foodListingId)) {
            throw new Error(`Invalid food listing ID: ${item.id}`);
          }
          return { food_listing_id: foodListingId, quantity: item.quantity };
        });
        // delivery_type and the customer coordinates are accepted by the
        // backend but not yet in the OrderCreate type; widen the payload so
        // they are serialized. Sending the confirmed position means the server
        // checks the zone against the same place the app just checked, instead
        // of falling back to the saved profile address.
        const payload: OrderCreate & {
          delivery_type: "pickup" | "delivery";
          customer_latitude?: number;
          customer_longitude?: number;
          customer_location_accuracy_m?: number;
        } = {
          quantity: items.reduce((sum, item) => sum + item.quantity, 0),
          total_amount: items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          ),
          customer_id: user.id,
          chef_id: chefId,
          items: orderLines,
          delivery_address: finalAddress,
          delivery_phone: phone,
          delivery_type: deliveryType,
          ...gate.orderLocationPayload,
          special_instructions: instructions.trim() || undefined,
        };
        const order = await orderService.createOrder(payload);
        await orderService.payOrder(order.id, { method: "CASH" });
        createdOrderIds.push(order.id);
        orderPlacedRef.current = true;
        clearCart();
      }

      const successChefName = isOfferMode
        ? offerCheckout!.chefName
        : items[0]?.chefName;
      router.replace({
        pathname: "/(tabs)/order-success",
        params: {
          orderIds: createdOrderIds.join(","),
          eta: etaText ?? "",
          chefName: successChefName ?? "",
        },
      });
    } catch (err: any) {
      Alert.alert("Order Failed", getCheckoutError(err));
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

        {/* Where the customer is. Only offered when sharing it would actually
            unlock delivery — never when the kitchen is the one out of range,
            and never in the way of a pickup order. */}
        {delivery.reason === "customer_location_unknown" && (
          <LocationRequiredCard
            status={gate.status}
            failure={gate.failure}
            isLocating={gate.isLocating}
            areaName={gate.area?.name}
            onRetryDeviceLocation={gate.requestDeviceLocation}
            onManualLocation={gate.setManualLocation}
            onOpenSettings={gate.openSettings}
          />
        )}

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

          <PhoneInput
            label="Phone Number *"
            value={phone}
            onChangeText={setPhone}
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

        {/* Delivery Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Delivery Method</Text>
          </View>

          <View style={styles.methodToggle}>
            <Pressable
              onPress={() => setDeliveryType("pickup")}
              style={[
                styles.methodOption,
                deliveryType === "pickup" && styles.methodOptionActive,
              ]}
            >
              <Ionicons
                name="storefront-outline"
                size={18}
                color={deliveryType === "pickup" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.methodOptionText,
                  deliveryType === "pickup" && styles.methodOptionTextActive,
                ]}
              >
                Pickup
              </Text>
            </Pressable>
            <Pressable
              disabled={!isDeliveryAvailable}
              onPress={() => setDeliveryType("delivery")}
              style={[
                styles.methodOption,
                deliveryType === "delivery" && styles.methodOptionActive,
                !isDeliveryAvailable && styles.methodOptionDisabled,
              ]}
            >
              <Ionicons
                name="bicycle-outline"
                size={18}
                color={deliveryType === "delivery" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.methodOptionText,
                  deliveryType === "delivery" && styles.methodOptionTextActive,
                ]}
              >
                Delivery
              </Text>
            </Pressable>
          </View>

          {/* Why Delivery is dimmed. Pickup stays available throughout, so this
              explains a missing option — it never blocks the order. */}
          {delivery.isChecking && (
            <Text style={styles.deliveryUnavailableNote}>
              Checking whether we can deliver to you…
            </Text>
          )}
          {delivery.deliveryAvailable === false && (
            <Text style={styles.deliveryUnavailableNote}>
              {delivery.message ??
                `FoodPal only delivers within ${areaName}. You can still place this order for pickup.`}
            </Text>
          )}

          {deliveryType === "pickup" ? (
            <>
              <View style={styles.addressBox}>
                {isPickupLoading ? (
                  <View style={styles.addressLoading}>
                    <ActivityIndicator size="small" color={colors.mutedForeground} />
                    <Text style={styles.addressLoadingText}>Loading chef address…</Text>
                  </View>
                ) : pickupAddress ? (
                  <View style={styles.addressRow}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                    {/* Masked until the order is confirmed — the customer sees
                        the area, not the chef's door. */}
                    <Text style={styles.addressText}>
                      {maskAddressEnhanced(pickupAddress, distanceToChef)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.addressUnavailable}>
                    Pickup address is unavailable for this chef.
                  </Text>
                )}
              </View>
              <Text style={styles.pickupNote}>
                📍 Exact pickup address will be shared after order confirmation
              </Text>
            </>
          ) : (
            <>
              <View style={styles.deliveryNotice}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <View style={styles.deliveryNoticeTextWrap}>
                  <Text style={styles.deliveryNoticeTitle}>Transportation cost on customer</Text>
                  <Text style={styles.deliveryNoticeBody}>
                    Delivery transportation costs are borne by the customer. The chef or delivery
                    person will coordinate delivery charges separately.
                  </Text>
                </View>
              </View>
              <View style={styles.textAreaContainer}>
                <LocationAutocomplete
                  label="Delivery Address"
                  required
                  focusOnLahore
                  placeholder={"Tap \u201cLocate me\u201d to set your delivery address"}
                  defaultValue={deliveryAddress}
                  error={
                    isDeliveryOutsideArea
                      ? `This address is outside our delivery zone. FoodPal currently delivers in ${areaName} only — locate yourself from an address inside the zone, or switch to pickup.`
                      : undefined
                  }
                  onLocationSelect={(loc) => {
                    setDeliveryAddress(loc.label);
                    setDeliveryCoords({ lat: loc.lat, lon: loc.lon });
                    // Where the food is going is the address this order should
                    // be judged on, so the gate uses it too.
                    gate.setManualLocation(loc.lat, loc.lon, loc.label);
                  }}
                />
                {!isDeliveryOutsideArea && (
                  <Text style={styles.pickupNote}>
                    Tap “Locate me” so the chef gets your exact delivery point. Add
                    landmarks or a floor in the notes below if it helps the rider.
                  </Text>
                )}
              </View>
            </>
          )}
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

        {/* Terms Acceptance */}
        <Pressable
          style={styles.termsRow}
          onPress={() => setAcceptedTerms((v) => !v)}
          hitSlop={6}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms ? (
              <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
            ) : null}
          </View>
          <Text style={styles.termsAcceptText}>
            {"I agree to the "}
            <Text
              style={styles.termsLink}
              onPress={() => openLink("/terms")}
            >
              Terms & Conditions
            </Text>
            {", "}
            <Text
              style={styles.termsLink}
              onPress={() => openLink("/refund-policy")}
            >
              Refund Policy
            </Text>
            {", and understand the order cancellation rules."}
          </Text>
        </Pressable>

        {/* Place Order Button */}
        <Button
          variant="primary"
          size="lg"
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
          loading={isSubmitting}
          disabled={
            isSubmitting || !acceptedTerms || isDeliveryOutsideArea
          }
        >
          {isSubmitting ? "Placing Order…" : `Place Order — ${formatPrice(checkoutTotal)}`}
        </Button>
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
    backgroundColor: colors.accentSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.accentSubtleForeground,
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
    backgroundColor: colors.accentSubtle,
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
  deliveryUnavailableNote: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
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
  methodToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  methodOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  methodOptionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },
  methodOptionDisabled: {
    opacity: 0.5,
  },
  methodOptionText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  methodOptionTextActive: {
    color: colors.primary,
  },
  deliveryNotice: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  deliveryNoticeTextWrap: {
    flex: 1,
    gap: 2,
  },
  deliveryNoticeTitle: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.foreground,
  },
  deliveryNoticeBody: {
    ...typography.xs,
    color: colors.mutedForeground,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  termsAcceptText: {
    ...typography.sm,
    color: colors.foreground,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: "600",
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
