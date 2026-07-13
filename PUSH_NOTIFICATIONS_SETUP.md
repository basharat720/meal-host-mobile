# Push Notifications — Mobile Setup

The mobile app uses **Expo Push** as the delivery transport. The client obtains an
Expo push token (`ExponentPushToken[...]`), stores it in the backend `fcm_token`
column (same column the web app uses for FCM tokens), and the backend routes
messages to Expo's push service — which fans out to **APNs (iOS)** and **FCM
(Android)** automatically.

## What's already implemented (code)

- `src/lib/pushNotifications.ts` — permission handling, Android channel, Expo push
  token registration, foreground notification handler, URL→route mapping.
- `src/hooks/usePushNotifications.ts` — registers/refreshes the token on login,
  handles foreground receipt, tap-to-navigate, and cold-start (app opened from a
  killed state by tapping a push). Mounted in `app/_layout.tsx`.
- `src/components/NotificationBell.tsx` — bell + unread badge (polls every 30s,
  syncs the OS app-icon badge). Placed on the customer home + chef dashboard.
- `app/notifications.tsx` — the in-app notification center (list, mark read, mark
  all read, pull-to-refresh, deep-link on tap).
- Backend `meal-host/app/services/notification_service.py` — `send()` now routes
  Expo tokens to `https://exp.host/--/api/v2/push/send` and native FCM tokens to
  Firebase, with shared stale-token cleanup (`DeviceNotRegistered`).

## Required manual setup (cannot be done in code)

Remote push does **not** work in Expo Go on SDK 54 — you need a development build
and EAS credentials.

1. **Create/link an EAS project**

   ```bash
   cd meal-host-mobile
   npx eas init          # writes expo.extra.eas.projectId in app.json
   ```

   Until this is set, `registerForPushNotificationsAsync()` logs a warning and
   returns `null` (the app still runs, just no push token).

2. **iOS — APNs key**
   - In Apple Developer, create an APNs Auth Key (.p8).
   - Upload it to EAS: `npx eas credentials` → iOS → Push Notifications.
   - The `aps-environment` entitlement is added automatically by EAS at build time.

3. **Android — FCM v1**
   - In the Firebase console (project `mealhost-dev`), download `google-services.json`.
   - Provide it to the build (EAS credentials, or `expo.android.googleServicesFile`).
   - Upload the **FCM v1 service account key** to EAS so Expo can send via FCM v1.

4. **Build a dev/preview client and install on a real device**

   ```bash
   npx eas build --profile development --platform ios
   npx eas build --profile development --platform android
   ```

   (Push tokens cannot be obtained on the iOS Simulator.)

5. **Notification icon (Android polish)** — Android status-bar icons must be a white
   silhouette on transparent. `app.json` currently points the `expo-notifications`
   plugin at `./assets/icon.png` (full color), which renders as a white square on
   Android. Replace with a dedicated monochrome asset when available.

## How to test end-to-end

1. Log in on a dev build (real device) and accept the notification prompt.
2. Confirm a token was saved: the backend `users` table should show an
   `ExponentPushToken[...]` value in `fcm_token` for that user.
3. Quick send test:

   ```bash
   curl -X POST https://exp.host/--/api/v2/push/send \
     -H "Content-Type: application/json" \
     -d '{"to":"ExponentPushToken[xxxx]","title":"Test","body":"Hello","data":{"url":"/my-orders"}}'
   ```

4. Verify all three delivery states:
   - **Foreground** — banner shows; the in-app bell badge increments.
   - **Background** — system notification; tapping it deep-links (e.g. `/my-orders`
     → Orders tab).
   - **Killed (cold start)** — tapping launches the app onto the mapped screen.
5. Trigger a real event (place an order, post a request, make an offer) and confirm
   the matching user receives both the push and an in-app notification row.
