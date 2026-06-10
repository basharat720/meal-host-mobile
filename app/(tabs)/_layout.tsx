import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, typography } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { View, Text, StyleSheet } from "react-native";

function CartBadge() {
  const { items } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          backgroundColor: colors.surface,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...typography.xs,
          fontFamily: fonts.sansSemiBold,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chefs"
        options={{
          title: "Chefs",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="bag-outline" size={size} color={color} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="post-request"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="order-success"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
