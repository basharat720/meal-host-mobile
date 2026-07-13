import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

/**
 * Push-notification transport = Expo Push.
 *
 * The client obtains an Expo push token (`ExponentPushToken[...]`) and stores it
 * in the same backend `fcm_token` field the web app uses. The backend detects the
 * token type and dispatches via Expo's push service (which fans out to APNs on iOS
 * and FCM on Android). See meal-host/app/services/notification_service.py.
 *
 * NOTE: Remote push does not work in Expo Go on SDK 54 — a development build is
 * required, along with a configured EAS project id (see `getProjectId`).
 */

const ANDROID_CHANNEL_ID = "default";

/**
 * How notifications behave while the app is in the FOREGROUND.
 * Must be registered at module load, before any notification can arrive.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 53+ replaced `shouldShowAlert` with the banner/list pair.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Android requires a notification channel to be created before notifications
 * can be displayed. iOS ignores this. Safe to call repeatedly.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#062D1E",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (err) {
    if (__DEV__) console.warn("[push] failed to create Android channel:", err);
  }
}

/** Resolve the EAS project id required by getExpoPushTokenAsync. */
function getProjectId(): string | undefined {
  const anyConstants = Constants as unknown as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };
  return (
    anyConstants?.expoConfig?.extra?.eas?.projectId ??
    anyConstants?.easConfig?.projectId ??
    undefined
  );
}

export type PermissionResult = "granted" | "denied" | "undetermined";

/** Current OS-level notification permission state, without prompting. */
export async function getPushPermissionStatus(): Promise<PermissionResult> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

/**
 * Ensure we have permission + an Android channel, then return the Expo push
 * token. Returns null (never throws) when permission is denied, when running on
 * a simulator/Expo Go, or when the EAS project id is missing — callers treat a
 * null token as "push unavailable" and carry on.
 *
 * @param requestIfNeeded when false, only reads the existing permission and does
 *   NOT show the OS prompt (used for silent re-registration on app launch).
 */
export async function registerForPushNotificationsAsync(
  requestIfNeeded = true
): Promise<string | null> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    // On iOS the user may have granted "provisional" authorization — treat any
    // non-denied granted-or-provisional state as usable.
    const alreadyAllowed =
      existing.granted ||
      existing.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!alreadyAllowed) {
      if (!requestIfNeeded) return null;
      if (status === "denied") return null; // user explicitly said no — don't nag
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = req.status;
      if (status !== "granted") return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      if (__DEV__) {
        console.warn(
          "[push] No EAS projectId found. Run `eas init` and set " +
            "expo.extra.eas.projectId in app.json to enable push tokens."
        );
      }
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data ?? null;
  } catch (err) {
    // Simulators, Expo Go, or missing native config land here — non-fatal.
    if (__DEV__) console.warn("[push] token registration failed:", err);
    return null;
  }
}

/**
 * Map a backend notification `url` (web-style path) to a mobile route.
 * The backend currently emits `/chef-dashboard`, `/my-orders`, `/my-requests`.
 * Unknown/empty urls fall back to the in-app notification center.
 */
export function mapNotificationUrlToRoute(url?: string | null): string {
  if (!url) return "/notifications";
  const path = url.split("?")[0].replace(/\/+$/, "");

  if (path === "" || path === "/") return "/notifications";
  if (path.startsWith("/chef-dashboard")) return "/(chef)/dashboard";
  if (path.startsWith("/my-orders")) return "/(tabs)/orders";

  // /my-requests/:id -> request detail; /my-requests -> list
  if (path.startsWith("/my-requests")) {
    const rest = path.slice("/my-requests".length);
    if (rest.startsWith("/")) {
      const id = rest.slice(1).split("/")[0];
      if (id) return `/my-requests/${id}`;
    }
    return "/(tabs)/my-requests";
  }

  return "/notifications";
}

/** Pull the `url` field out of a notification's data payload, if present. */
export function extractUrl(
  notification: Notifications.Notification | null | undefined
): string | undefined {
  const data = notification?.request?.content?.data as
    | Record<string, unknown>
    | undefined;
  const url = data?.url;
  return typeof url === "string" ? url : undefined;
}

export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Badge count is best-effort; unsupported platforms are ignored.
  }
}
