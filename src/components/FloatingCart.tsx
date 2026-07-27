import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, usePathname, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

// Screens that are part of the cart flow itself — a shortcut back to the cart
// would be redundant here.
const HIDDEN_SCREENS = ["cart", "checkout", "order-success"];

/**
 * Global floating cart button. Mounted once at the root so it overlays every
 * screen. Mirrors the bottom-nav cart: same count badge, tapping opens the cart.
 *
 * Shown to customers AND logged-out users — the cart is populated from
 * AsyncStorage regardless of auth, so a logged-out shopper still sees their
 * items and a live count. It is NEVER rendered for a chef: the button is the
 * entry point into the customer experience, so showing it to a chef would let
 * them cross into it. A logged-out tap routes to sign-in (with a redirect back
 * to the cart) instead of opening the cart directly.
 */
export function FloatingCart() {
  const { items } = useCart();
  const { isCustomer, isChef } = useAuth();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  // usePathname isn't used for logic but subscribing keeps the button in sync
  // as the active route changes.
  usePathname();

  const group = segments[0] as string | undefined;
  const inTabs = group === "(tabs)";
  const inAuth = group === "(auth)";
  const onHiddenScreen = segments.some((s) => HIDDEN_SCREENS.includes(s));

  // Role gate: never for chefs. Customers and logged-out users both see it.
  if (isChef) return null;
  // Never over the auth flow itself (login / signup / etc.) — a cart shortcut
  // that bounces back to login would be circular.
  if (inAuth) return null;
  if (onHiddenScreen) return null;

  const count = items.reduce((s, i) => s + i.quantity, 0);

  // A logged-out user gets routed to sign-in first; on success the login screen
  // replaces to this `redirect`, landing them back on the cart.
  const openCart = () =>
    isCustomer
      ? router.push("/(tabs)/cart")
      : router.push({
          pathname: "/(auth)/customer-login",
          params: { redirect: "/(tabs)/cart" },
        });

  // Sit above the tab bar on tab screens; otherwise just above the bottom inset.
  const bottom = inTabs ? insets.bottom + 62 + 14 : insets.bottom + 24;

  return (
    <Pressable
      style={[styles.fab, { bottom }]}
      onPress={openCart}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Open cart${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
    >
      <Ionicons name="bag" size={24} color="#fff" />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    // Elevation / shadow so it reads as floating
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.foreground,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
