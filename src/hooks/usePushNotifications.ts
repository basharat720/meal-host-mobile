import { useEffect, useRef } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/services/userService";
import {
  registerForPushNotificationsAsync,
  mapNotificationUrlToRoute,
  extractUrl,
  setAppBadgeCount,
} from "@/lib/pushNotifications";

const PUSH_TOKEN_KEY = "fcm_push_token";
// Mirrors FCM_KEY in AuthContext, which is cleared on sign-out so the next
// user re-registers their own token.
const PUSH_USER_KEY = "fcm_registered";

export const NOTIFICATIONS_UNREAD_KEY = ["notifications", "unread"] as const;
export const NOTIFICATIONS_LIST_KEY = ["notifications", "list"] as const;

function navigateToUrl(url?: string | null) {
  const route = mapNotificationUrlToRoute(url);
  try {
    // Cast: typed routes can't express the dynamic string union here.
    router.push(route as never);
  } catch {
    router.push("/notifications" as never);
  }
}

/**
 * Central push-notification wiring. Mounted once, high in the tree, under the
 * auth + query providers. Handles:
 *  - registering the Expo push token whenever a user is logged in (dedup + resave
 *    on token/user change)
 *  - a foreground listener that keeps the unread badge fresh
 *  - a response listener that deep-links when the user taps a notification
 *  - the cold-start case: app launched from a killed state by tapping a push
 */
export function usePushNotifications(): void {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = dbUser?.id ?? null;
  const coldStartHandled = useRef(false);

  // Register / refresh the push token for the logged-in user.
  useEffect(() => {
    if (userId == null) {
      // Logged out — clear the stale OS app-icon badge.
      setAppBadgeCount(0);
      return;
    }
    let cancelled = false;

    (async () => {
      const token = await registerForPushNotificationsAsync(true);
      if (!token || cancelled) return;
      try {
        const [cachedToken, cachedUser] = await Promise.all([
          AsyncStorage.getItem(PUSH_TOKEN_KEY),
          AsyncStorage.getItem(PUSH_USER_KEY),
        ]);
        if (token !== cachedToken || String(userId) !== cachedUser) {
          await userService.saveFcmToken(userId, token);
          await AsyncStorage.multiSet([
            [PUSH_TOKEN_KEY, token],
            [PUSH_USER_KEY, String(userId)],
          ]);
        }
      } catch (err) {
        if (__DEV__) console.warn("[push] saveFcmToken failed:", err);
        // Clear cache so we retry on next launch.
        await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Listeners live for the lifetime of the app session (independent of login,
  // so a tap always routes even mid-auth-transition).
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // A push arrived while the app is foregrounded — refresh the badge/list.
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = extractUrl(response.notification);
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY });
        navigateToUrl(url);
      }
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [queryClient]);

  // Cold start: the app was launched by tapping a notification while killed.
  useEffect(() => {
    if (coldStartHandled.current) return;
    let cancelled = false;

    (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || coldStartHandled.current || !response) return;
      coldStartHandled.current = true;
      const url = extractUrl(response.notification);
      // Defer slightly so the root navigator is mounted before we push.
      setTimeout(() => navigateToUrl(url), 400);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
