import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  notificationService,
  AppNotification,
} from "@/services/notificationService";
import {
  NOTIFICATIONS_LIST_KEY,
  NOTIFICATIONS_UNREAD_KEY,
} from "@/hooks/usePushNotifications";
import { mapNotificationUrlToRoute } from "@/lib/pushNotifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

function timeAgo(dateStr: string): string {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return "";
  const diff = Date.now() - parsed;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const {
    data: notifications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: NOTIFICATIONS_LIST_KEY,
    queryFn: () => notificationService.getAll(),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const refreshUnread = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY });
  }, [queryClient]);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onMutate: async (id: number) => {
      // Optimistically flip the row to read.
      queryClient.setQueryData<AppNotification[]>(
        NOTIFICATIONS_LIST_KEY,
        (prev) =>
          prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? prev
      );
    },
    onSettled: refreshUnread,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: async () => {
      queryClient.setQueryData<AppNotification[]>(
        NOTIFICATIONS_LIST_KEY,
        (prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev
      );
    },
    onSettled: refreshUnread,
  });

  const handlePress = (n: AppNotification) => {
    if (!n.is_read) markReadMutation.mutate(n.id);
    const route = mapNotificationUrlToRoute(n.url);
    // Don't bounce back to this same screen if the url has no better target.
    if (route !== "/notifications") {
      router.push(route as never);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      onPress={() => handlePress(item)}
      style={({ pressed }) => [
        styles.row,
        !item.is_read && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowLeft}>
        {!item.is_read ? (
          <View style={styles.dot} />
        ) : (
          <View style={styles.dotPlaceholder} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {!!item.body && (
          <Text style={styles.body} numberOfLines={3}>
            {item.body}
          </Text>
        )}
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      {!!item.url && mapNotificationUrlToRoute(item.url) !== "/notifications" && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.mutedForeground}
          style={styles.chevron}
        />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refreshUnread();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="No notifications yet"
              description="You'll see order updates, offers, and requests here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 24, justifyContent: "center" },
  headerTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  markAll: {
    ...typography.sm,
    color: colors.primary,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
  },

  listContent: { paddingVertical: spacing.xs },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  rowUnread: { backgroundColor: colors.muted },
  rowPressed: { opacity: 0.6 },
  rowLeft: { width: 18, paddingTop: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotPlaceholder: { width: 8, height: 8 },
  rowBody: { flex: 1, gap: 2 },
  title: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  body: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  time: {
    ...typography.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  chevron: { alignSelf: "center", marginLeft: spacing.xs },
});
