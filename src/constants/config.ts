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
