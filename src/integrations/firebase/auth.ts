import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  AuthCredential,
  signInWithCredential,
  User as FirebaseUser,
  updateProfile,
  reload,
} from "firebase/auth";
import { auth } from "./config";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import {
  FACEBOOK_AUTH_ENABLED,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/constants/config";

// Loaded lazily, and only when Facebook is configured, so a build without a
// Facebook App ID never touches the SDK.
const loadFacebookSdk = () =>
  require("react-native-fbsdk-next") as typeof import("react-native-fbsdk-next");
import { authEmailService } from "@/services/authEmailService";
import { ApiError } from "@/lib/api";

export type UserRole = "chef" | "customer";

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

/**
 * Raised when the person closes the Google or Facebook sign-in window. Screens treat it as
 * "nothing happened" rather than a failure.
 */
export class SignInCancelledError extends Error {
  code = "auth/sign-in-cancelled";
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "SignInCancelledError";
  }
}

export const isSignInCancelled = (error: unknown): boolean =>
  error instanceof SignInCancelledError ||
  (error as { code?: string } | null)?.code === "auth/sign-in-cancelled";

export const signUpWithEmail = async (
  email: string,
  password: string,
  role: UserRole,
  fullName?: string
): Promise<{ user: FirebaseUser | null; token: string | null; error: Error | null }> => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    if (fullName) await updateProfile(user, { displayName: fullName });
    // Verification email is NOT sent from here. The backend sends a branded one
    // when the account is registered (POST /users/), because Firebase's own
    // template body can't be edited. Calling sendEmailVerification() here would
    // send the unbranded Firebase email as well.
    const token = await user.getIdToken();
    return { user, token, error: null };
  } catch (error) {
    return { user: null, token: null, error: error as Error };
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ user: FirebaseUser | null; token: string | null; error: Error | null }> => {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdToken();
    return { user: credential.user, token, error: null };
  } catch (error) {
    return { user: null, token: null, error: error as Error };
  }
};

export const signInWithGoogle = async (): Promise<{
  user: FirebaseUser | null;
  token: string | null;
  error: Error | null;
}> => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) throw new SignInCancelledError();
    const idToken = response.data.idToken;
    if (!idToken) throw new Error("Google sign-in failed: no ID token returned.");
    const firebaseCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, firebaseCredential);
    const token = await result.user.getIdToken();
    return { user: result.user, token, error: null };
  } catch (error) {
    if (error instanceof SignInCancelledError) return { user: null, token: null, error };
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { user: null, token: null, error: new SignInCancelledError() };
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return { user: null, token: null, error: new Error("Google sign-in is already open.") };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          user: null,
          token: null,
          error: new Error("Google Play Services is missing or out of date on this phone."),
        };
      }
    }
    // Clear any half-finished Google session so the next tap shows the picker.
    try { await GoogleSignin.signOut(); } catch {}
    return { user: null, token: null, error: error as Error };
  }
};

// Firebase keeps one account per email. Signing in with Facebook on an email
// that already has a password or Google account fails rather than merging.
const friendlySocialError = (error: unknown, providerLabel: string): Error => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "auth/account-exists-with-different-credential") {
    return new Error(
      `An account already exists for this email. Sign in the way you did before (email and password, or Google), not with ${providerLabel}.`
    );
  }
  return error instanceof Error ? error : new Error(`${providerLabel} sign-in failed. Please try again.`);
};

/**
 * Facebook sign-in. Android uses classic login and hands Firebase the access
 * token. iPhone uses Limited Login, which needs no App Tracking Transparency
 * prompt but returns an OIDC token instead of a Graph access token, so it goes
 * to Firebase as an ID token with a nonce: Facebook is given the SHA-256 of a
 * random nonce and Firebase the raw value, and Firebase checks they match.
 */
export const signInWithFacebook = async (): Promise<{
  user: FirebaseUser | null;
  token: string | null;
  error: Error | null;
}> => {
  if (!FACEBOOK_AUTH_ENABLED) {
    return { user: null, token: null, error: new Error("Facebook sign-in is not available.") };
  }
  const { LoginManager, AccessToken, AuthenticationToken } = loadFacebookSdk();
  const permissions = ["public_profile", "email"];
  try {
    let credential: AuthCredential;
    if (Platform.OS === "ios") {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const result = await LoginManager.logInWithPermissions(permissions, "limited", hashedNonce);
      if (result.isCancelled) throw new SignInCancelledError();
      const tokenData = await AuthenticationToken.getAuthenticationTokenIOS();
      if (!tokenData?.authenticationToken) {
        throw new Error("Facebook sign-in failed: no token returned.");
      }
      credential = new OAuthProvider("facebook.com").credential({
        idToken: tokenData.authenticationToken,
        rawNonce,
      });
    } else {
      const result = await LoginManager.logInWithPermissions(permissions);
      if (result.isCancelled) throw new SignInCancelledError();
      const data = await AccessToken.getCurrentAccessToken();
      if (!data?.accessToken) throw new Error("Facebook sign-in failed: no access token returned.");
      credential = FacebookAuthProvider.credential(data.accessToken);
    }
    const result = await signInWithCredential(auth, credential);
    const token = await result.user.getIdToken();
    return { user: result.user, token, error: null };
  } catch (error) {
    if (error instanceof SignInCancelledError) return { user: null, token: null, error };
    try { LoginManager.logOut(); } catch {}
    return { user: null, token: null, error: friendlySocialError(error, "Facebook") };
  }
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
  // Forget the Google account too, so the next "Continue with Google" lets the
  // person choose an account instead of silently reusing the last one.
  try { await GoogleSignin.signOut(); } catch {}
  if (FACEBOOK_AUTH_ENABLED) {
    try { loadFacebookSdk().LoginManager.logOut(); } catch {}
  }
};

// Send password reset email (sent by our backend, not Firebase)
export const sendPasswordReset = async (
  email: string
): Promise<{ error: Error | null }> => {
  try {
    await authEmailService.requestPasswordReset(email);
    return { error: null };
  } catch (error) {
    console.error("Password reset error:", error);

    // Note: there is deliberately no "no account found" case any more. The
    // backend returns the same response for known and unknown addresses so it
    // can't be used to test whether someone has an account.
    if (error instanceof ApiError && error.status === 429) {
      return { error: new Error("Too many password reset requests. Please try again later.") };
    }
    return {
      error: new Error("We couldn't send the reset email just now. Please try again shortly."),
    };
  }
};

export const resendEmailVerification = async (): Promise<{ error: Error | null }> => {
  try {
    const user = auth.currentUser;
    if (!user) return { error: new Error("No user is currently signed in.") };
    await reload(user);
    if (user.emailVerified) return { error: new Error("Email is already verified.") };
    // Sent by our backend so it carries FoodPal branding.
    await authEmailService.sendEmailVerification();
    return { error: null };
  } catch (error) {
    console.error("Resend email verification error:", error);

    if (error instanceof ApiError) {
      // The backend applies its own per-address cooldown on top of the
      // screen's countdown, so 429 is reachable after a reinstall or a
      // resend from the web app.
      if (error.status === 429) {
        return { error: new Error("Too many verification email requests. Please try again later.") };
      }
      if (error.status === 400) {
        return { error: new Error("Email is already verified.") };
      }
    }
    return {
      error: new Error("We couldn't send the verification email just now. Please try again shortly."),
    };
  }
};

export const checkEmailVerification = async (): Promise<{
  isVerified: boolean;
  error: Error | null;
}> => {
  try {
    const user = auth.currentUser;
    if (!user) return { isVerified: false, error: new Error("No user is currently signed in.") };
    await reload(user);
    return { isVerified: user.emailVerified, error: null };
  } catch (error) {
    return { isVerified: false, error: error as Error };
  }
};
