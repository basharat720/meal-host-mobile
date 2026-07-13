import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notificationService";
import { NOTIFICATIONS_UNREAD_KEY } from "@/hooks/usePushNotifications";
import { setAppBadgeCount } from "@/lib/pushNotifications";
import { colors } from "@/constants/theme";

interface Props {
  color?: string;
  size?: number;
}

export function NotificationBell({ color = colors.foreground, size = 24 }: Props) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: NOTIFICATIONS_UNREAD_KEY,
    queryFn: () => notificationService.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const count = data?.count ?? 0;

  // Keep the OS app-icon badge in sync with the unread count.
  useEffect(() => {
    if (user) setAppBadgeCount(count);
  }, [count, user]);

  if (!user) return null;

  return (
    <Pressable
      onPress={() => router.push("/notifications" as never)}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `Notifications, ${count} unread` : "Notifications"
      }
    >
      <Ionicons name="notifications-outline" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: colors.destructive,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
