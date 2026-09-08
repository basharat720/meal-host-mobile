import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  updateProfile,
  reload,
} from "firebase/auth";
import { auth } from "./config";
import { GoogleSignin } from "@/integrations/google-signin-stub";
import { authEmailService } from "@/services/authEmailService";
import { ApiError } from "@/lib/api";

export type UserRole = "chef" | "customer";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
});

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

export const signInWithGoogle = async (
  role: UserRole
): Promise<{ user: FirebaseUser | null; token: string | null; error: Error | null }> => {
  try {
    await GoogleSignin.hasPlayServices();
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;
    if (!idToken) throw new Error("Google sign-in failed: no ID token returned.");
    const firebaseCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, firebaseCredential);
    const token = await result.user.getIdToken();
    return { user: result.user, token, error: null };
  } catch (error) {
    return { user: null, token: null, error: error as Error };
  }
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
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
    // Sent by our backend so it carries Pakwanhus branding.
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
