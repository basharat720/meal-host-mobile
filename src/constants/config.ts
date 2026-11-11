// Backend API base URL — set EXPO_PUBLIC_BACKEND_API_URL in .env.local
// For a physical device use your Mac's LAN IP, e.g. http://192.168.18.71:8000
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_API_URL ?? "http://localhost:8000";

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyB2wArLAPSwUP1NCmz_u8hz52V9Y9lmSW8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "mealhost-dev.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "mealhost-dev",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "mealhost-dev.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "837237844814",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "1:837237844814:web:224a6b389f8b173f8e4c1f",
};

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/**
 * Google Places (New) + Geocoding, for address search and "Locate me". Without
 * it, search is off and "Locate me" falls back to OpenStreetMap for the label.
 */
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Whether to offer "Continue with Google" on the auth screens.
 *
 * Needs a native build: @react-native-google-signin/google-signin does not run
 * in Expo Go. Android is matched by package name + signing-key SHA-1, so every
 * key that signs a build (debug, upload, and Play's app-signing key) must be
 * registered on the FoodPal Android app in Firebase (project mealhost-dev).
 */
export const SOCIAL_AUTH_ENABLED = true;

/**
 * OAuth client IDs for Google sign-in (Firebase project mealhost-dev). They
 * are public identifiers, not secrets, so they default to the real values and
 * a release build can't silently ship with them blank.
 *
 * - Web client: the audience of the ID token Firebase verifies (both OSes).
 * - iOS client: belongs to bundle com.mealhost.mobile. Its reversed form is the
 *   iosUrlScheme of the google-signin plugin in app.json — change both together.
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "837237844814-vevq405rh0ga07g7e8ngkh74ktcuums4.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "837237844814-9qab1etbs8jpgu6ip9en3u04q8bsiuhs.apps.googleusercontent.com";

/**
 * Facebook (Meta) app for "Continue with Facebook". The button only appears
 * when an App ID is set; app.config.js adds the react-native-fbsdk-next plugin
 * from the same variables, so the JS switch and the native setup always match
 * within one build. Both values are embedded in the app, so neither is secret.
 *
 * The same Meta app must also be enabled as the Facebook provider in Firebase
 * (project mealhost-dev) with its App Secret — that also fixes the website's
 * Facebook button.
 */
export const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? "";
export const FACEBOOK_AUTH_ENABLED = SOCIAL_AUTH_ENABLED && FACEBOOK_APP_ID !== "";
