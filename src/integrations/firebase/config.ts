import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "@/constants/config";

// Track whether this is the very first module evaluation in this JS context.
// On QR-code scan: getApps() is empty → isFirstInit = true → we call initializeAuth.
// On Fast Refresh: getApps() already has the app → isFirstInit = false → getAuth() reuses it.
const isFirstInit = getApps().length === 0;

const app: FirebaseApp = isFirstInit ? initializeApp(FIREBASE_CONFIG) : getApp();

let auth: Auth;
if (isFirstInit) {
  // First initialization in this JS context.
  // Import directly from the RN-specific bundle to guarantee getReactNativePersistence
  // is available regardless of how Metro resolves the 'firebase/auth' wrapper package.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require("@firebase/auth/dist/rn/index.js");
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Should not happen in Expo Go / RN, but fall back gracefully.
    if (__DEV__) console.warn("[Firebase] RN persistence unavailable, session will not persist:", e);
    auth = getAuth(app);
  }
} else {
  // JS context already has an initialized auth instance (Fast Refresh).
  // getAuth() returns the same instance with its already-configured persistence.
  auth = getAuth(app);
}

export { auth };
export const storage: FirebaseStorage = getStorage(app);
export default app;
