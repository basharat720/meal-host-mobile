/**
 * Extends app.json with values that come from the environment.
 *
 * The address map (react-native-maps) uses Google Maps on Android, which needs
 * the Maps SDK key in the Android manifest; prebuild writes it there from
 * `android.config.googleMaps.apiKey`. It is the same key the app uses for
 * Places search (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local) — restrict it
 * in Google Cloud to the Maps SDK for Android, Places API (New) and Geocoding
 * API. iPhone uses Apple Maps and needs no key.
 */
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN;

/**
 * "Continue with Facebook" (react-native-fbsdk-next). Added only when both the
 * App ID and Client Token are set, matching FACEBOOK_AUTH_ENABLED in
 * src/constants/config.ts. Auto-init, automatic app events and advertiser ID
 * collection stay off, and there is no iOS tracking prompt — iPhone uses
 * Facebook's Limited Login, which needs none.
 */
const facebookPlugin =
  facebookAppId && facebookClientToken
    ? [
        [
          "react-native-fbsdk-next",
          {
            appID: facebookAppId,
            clientToken: facebookClientToken,
            displayName: "FoodPal",
            scheme: `fb${facebookAppId}`,
            isAutoInitEnabled: false,
            autoLogAppEventsEnabled: false,
            advertiserIDCollectionEnabled: false,
          },
        ],
      ]
    : [];

module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), ...facebookPlugin],
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },
  },
});
