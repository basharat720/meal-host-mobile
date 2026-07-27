import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPushPermissionStatus,
  registerForPushNotificationsAsync,
} from "@/lib/pushNotifications";

const DISMISSED_KEY = "push_prompt_dismissed";

/**
 * Dismissible soft-ask card reminding a logged-in user to enable push
 * notifications. Purely additive: it appears a couple of seconds after mount
 * ONLY when the user is logged in, hasn't dismissed it before, and the OS
 * permission is still undetermined. It never re-triggers the OS prompt on its
 * own — tapping "Enable" runs the existing registration path; "Not now" hides
 * it and remembers the choice. Any error reading permission fails safe (hidden).
 */
export function NotificationPrompt() {
  const { dbUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const isLoggedIn = dbUser != null;

  useEffect(() => {
    if (!isLoggedIn) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
        if (dismissed === "true") return;
        const status = await getPushPermissionStatus();
        if (status !== "undetermined") return; // already granted or denied
        if (cancelled) return;
        // Small delay so it doesn't flash immediately after login.
        timer = setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 2000);
      } catch {
        // Can't read permission/storage — fail safe by not showing the card.
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isLoggedIn]);

  const handleEnable = async () => {
    setVisible(false);
    try {
      await registerForPushNotificationsAsync(true);
    } catch {
      // Registration is best-effort; the OS prompt / silent path handles state.
    }
  };

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Non-fatal — worst case the reminder appears again next launch.
    }
  };

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { paddingBottom: spacing.md + insets.bottom }]}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Stay updated</Text>
          <Text style={styles.subtitle}>
            Get notified when your order is confirmed or ready.
          </Text>
          <View style={styles.actions}>
            <Button size="sm" onPress={handleEnable}>
              Enable
            </Button>
            <Button size="sm" variant="ghost" onPress={handleDismiss}>
              Not now
            </Button>
          </View>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
          style={styles.close}
        >
          <Ionicons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 62, // sit just above the tab bar
    paddingHorizontal: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.lightSage,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  subtitle: {
    ...typography.sm,
    fontFamily: fonts.sans,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  close: { padding: 2 },
});
