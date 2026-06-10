// Stub for @react-native-google-signin/google-signin.
// The real package requires a custom native build and cannot run in Expo Go.
// In production builds (EAS), swap this stub for the real package.
export const GoogleSignin = {
  configure: (_opts?: Record<string, unknown>) => {},
  hasPlayServices: async () => {},
  signIn: async (): Promise<{ data: { idToken: string } }> => {
    throw new Error(
      "Google Sign-In requires a custom dev build (EAS). Use email/password in Expo Go."
    );
  },
  signOut: async () => {},
  isSignedIn: async () => false,
  getCurrentUser: async () => null,
  revokeAccess: async () => {},
};

export const statusCodes = {
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  IN_PROGRESS: "IN_PROGRESS",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
};
