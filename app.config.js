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
module.exports = ({ config }) => ({
  ...config,
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
