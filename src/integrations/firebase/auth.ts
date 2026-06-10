import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  updateProfile,
  AuthError,
  reload,
} from "firebase/auth";
import { auth } from "./config";
import { GoogleSignin } from "@/integrations/google-signin-stub";

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
    await sendEmailVerification(user);
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

export const sendPasswordReset = async (
  email: string
): Promise<{ error: Error | null }> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error) {
    const authError = error as AuthError;
    if (authError.code === "auth/user-not-found") {
      return { error: new Error("No account found with this email address.") };
    }
    if (authError.code === "auth/too-many-requests") {
      return { error: new Error("Too many requests. Please try again later.") };
    }
    return { error: authError as Error };
  }
};

export const resendEmailVerification = async (): Promise<{ error: Error | null }> => {
  try {
    const user = auth.currentUser;
    if (!user) return { error: new Error("No user is currently signed in.") };
    await reload(user);
    if (user.emailVerified) return { error: new Error("Email is already verified.") };
    await sendEmailVerification(user);
    return { error: null };
  } catch (error) {
    return { error: error as Error };
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
