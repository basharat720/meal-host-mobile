import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, typography } from "@/constants/theme";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useAuth } from "@/contexts/AuthContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { dbUser, activeRole } = useAuth();

  // Role guard: the customer tabs are public for browsing (logged-out users land
  // here), but someone acting as a chef belongs in the chef portal. Keyed on
  // activeRole so a dual-role account can browse as a customer; activeRole is
  // restored from storage asynchronously, so fall back to the confirmed backend
  // role until it resolves. Never act on a stale cached role.
  const actingAsChef = activeRole ? activeRole === "chef" : dbUser?.is_chef === true;
  if (actingAsChef) return <Redirect href="/(chef)/dashboard" />;

  return (
    <View style={styles.root}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          backgroundColor: colors.surface,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...typography.xs,
          fontFamily: fonts.sansSemiBold,
          fontWeight: "600",
        },
      }}
    >
      {/* Find Chefs leads, and is the tab the app opens on — it's the landing
          page on web too, where its nav item is likewise labelled "Home".
          The dish feed follows as "Dishes". Declaration order is tab order. */}
      <Tabs.Screen
        name="chefs"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Dishes",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      {/* Saved kitchens and dishes are something you come back to, so they get a
          tab of their own rather than being buried in the profile. */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
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
      <NotificationPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
