import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { User as FirebaseUser, onAuthStateChanged, onIdTokenChanged, reload } from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/integrations/firebase/config";
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut as firebaseSignOut,
  sendPasswordReset,
  resendEmailVerification,
  checkEmailVerification,
  UserRole,
} from "@/integrations/firebase/auth";
import { userService, User as DbUser, UserRegisterRequest } from "@/services/api";

const TOKEN_KEY = "firebase_token";
const ROLE_KEY = "user_role";
const FCM_KEY = "fcm_registered";
// Set when user logs in, cleared on sign-out.
// Lets us know we should WAIT for Firebase to restore the session instead of
// immediately redirecting to login when onAuthStateChanged fires null first.
const SESSION_FLAG_KEY = "mh_has_session";

interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Location payload accepted by signUp. Mirrors UserRegisterRequest.location.
interface SignUpLocationInput {
  latitude: number;
  longitude: number;
  address?: string;
}

interface AuthError {
  message: string;
  code: "NETWORK_ERROR" | "SERVER_ERROR" | "AUTH_ERROR" | "NOT_FOUND" | "UNKNOWN";
  status?: number;
  canRetry: boolean;
}

// Classify a backend error (from userService) into an AuthError. Pure helper so
// both the auth-state listener and retryAuth can share the same logic.
// NOTE: 404 is handled by callers (new-user creation) BEFORE this runs.
const classifyAuthError = (err: any): AuthError => {
  const status: number | undefined = typeof err?.status === "number" ? err.status : undefined;
  const message: string = err?.message || "";
  // Explicit auth failures: 401/403, or a hard token/refresh failure surfaced as a plain Error.
  if (
    status === 401 ||
    status === 403 ||
    /authentication failed|sign in again|token refresh failed/i.test(message)
  ) {
    return {
      message:
        status === 403
          ? "Access denied. Your account does not have the required permissions."
          : "Your session has expired or is invalid. Please sign in again.",
      code: "AUTH_ERROR",
      status,
      canRetry: false,
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      message: "Our servers are temporarily experiencing issues. Please try again in a few moments.",
      code: "SERVER_ERROR",
      status,
      canRetry: true,
    };
  }
  if (status === undefined) {
    // No HTTP status — treat as a connectivity problem and let the user retry.
    return {
      message: "Unable to reach our servers. Please check your connection and try again.",
      code: "NETWORK_ERROR",
      canRetry: true,
    };
  }
  // Other 4xx — surface but don't loop on retries.
  return {
    message: message || "An unexpected error occurred. Please try again.",
    code: "UNKNOWN",
    status,
    canRetry: false,
  };
};

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  role: UserRole | null;
  loading: boolean;
  token: string | null;
  emailVerified: boolean | null;
  authError: AuthError | null;
  clearError: () => void;
  retryAuth: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    role: UserRole,
    fullName?: string,
    additionalData?: Partial<UserRegisterRequest>,
    phone?: string,
    location?: SignUpLocationInput,
    profilePictureUrl?: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole | null) => void;
  getFreshToken: () => Promise<string | null>;
  refreshDbUser: () => Promise<DbUser | null>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  resendEmailVerification: () => Promise<{ error: Error | null }>;
  checkEmailVerification: () => Promise<{ isVerified: boolean; error: Error | null }>;
  isChef: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const convertFirebaseUser = (firebaseUser: FirebaseUser | null): User | null => {
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storeToken = async (t: string) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      setToken(t);
    } catch {}
  };

  const removeToken = async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
    } catch {}
  };

  const setRole = async (r: UserRole | null) => {
    setRoleState(r);
    if (r) await AsyncStorage.setItem(ROLE_KEY, r);
    else await AsyncStorage.removeItem(ROLE_KEY);
  };

  useEffect(() => {
    // Load stored token on mount
    SecureStore.getItemAsync(TOKEN_KEY).then(t => { if (t) setToken(t); }).catch(() => {});
  }, []);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeToken: (() => void) | undefined;
    let sessionTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupAuth = async () => {
      // Know BEFORE subscribing whether we expect a persisted session.
      const sessionFlag = await AsyncStorage.getItem(SESSION_FLAG_KEY);
      let waitingForSession = sessionFlag === "1";

      const clearSessionWait = () => {
        waitingForSession = false;
        if (sessionTimeout) { clearTimeout(sessionTimeout); sessionTimeout = null; }
      };

      const handleLogout = async () => {
        clearSessionWait();
        await AsyncStorage.removeItem(SESSION_FLAG_KEY);
        setUser(null);
        setDbUser(null);
        setRoleState(null);
        setEmailVerified(null);
        await removeToken();
        await AsyncStorage.removeItem(ROLE_KEY);
        await AsyncStorage.removeItem(FCM_KEY);
        if (tokenRefreshRef.current) { clearInterval(tokenRefreshRef.current); tokenRefreshRef.current = null; }
        setLoading(false);
      };

      unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (sessionTimeout) { clearTimeout(sessionTimeout); sessionTimeout = null; }

        setLoading(true);

        if (firebaseUser) {
          // Session confirmed — cancel any pending wait
          clearSessionWait();
          await AsyncStorage.setItem(SESSION_FLAG_KEY, "1");

          setUser(convertFirebaseUser(firebaseUser));
          try {
            // Pull latest profile from Firebase so email_verified is current,
            // then force a fresh token if email is verified (old cached tokens
            // still carry email_verified:false and keep the chef inactive).
            try { await reload(firebaseUser); } catch {}
            setEmailVerified(firebaseUser.emailVerified);
            const t = await firebaseUser.getIdToken(firebaseUser.emailVerified === true);
            await storeToken(t);

            try {
              const backendUser = await userService.getUser();
              setDbUser(backendUser);
              const resolvedRole: UserRole = backendUser.is_chef ? "chef" : "customer";
              setRoleState(resolvedRole);
              await AsyncStorage.setItem(ROLE_KEY, resolvedRole);
              setAuthError(null);
            } catch (err: any) {
              const cachedRole = (await AsyncStorage.getItem(ROLE_KEY)) as UserRole | null;
              if (err?.status === 404) {
                // Backend has no profile yet (new user). Create it from the cached
                // intended role. This is the ONLY branch that may assume a role.
                const roleToUse: UserRole = cachedRole === "chef" ? "chef" : "customer";
                try {
                  const created = await userService.createUser({
                    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
                    email: firebaseUser.email!,
                    firebase_uid: firebaseUser.uid,
                    is_chef: roleToUse === "chef",
                    is_customer: roleToUse === "customer",
                    status: "active",
                  });
                  setDbUser(created);
                  const r: UserRole = created.is_chef ? "chef" : "customer";
                  setRoleState(r);
                  await AsyncStorage.setItem(ROLE_KEY, r);
                  setAuthError(null);
                } catch (createErr: any) {
                  // Profile creation failed — surface a (retryable) error instead
                  // of silently assuming a role.
                  setAuthError(classifyAuthError(createErr));
                }
              } else {
                // getUser failed for a reason other than 404. Do NOT silently
                // assume role="customer" anymore.
                const ae = classifyAuthError(err);
                setAuthError(ae);
                if (ae.code === "AUTH_ERROR") {
                  // Explicit 401/403 (or hard auth failure): tear down the session,
                  // mirroring the web behavior.
                  await AsyncStorage.removeItem(SESSION_FLAG_KEY);
                  try { await firebaseSignOut(); } catch {}
                  await handleLogout();
                }
                // Network/5xx/other: keep the Firebase session so the user can retry;
                // role stays unresolved (null) rather than defaulting to customer.
              }
            }
          } catch {}
          setLoading(false);
        } else {
          // Firebase fired null. Two possibilities:
          // A) Genuine logged-out state (first-time user or explicit sign-out)
          // B) Intermediate null emitted before AsyncStorage read completes
          if (waitingForSession) {
            // We had a stored session flag — this is likely case B.
            // Hold loading=true and wait up to 5s for Firebase to fire again with the user.
            sessionTimeout = setTimeout(() => {
              // Gave up waiting — session probably expired or is invalid
              handleLogout();
            }, 5000);
            // Stay in loading state; do NOT call setLoading(false) here
          } else {
            // No session expected — genuine logout / first launch
            await handleLogout();
          }
        }
      });

      unsubscribeToken = onIdTokenChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const t = await firebaseUser.getIdToken();
            await storeToken(t);
            setEmailVerified(firebaseUser.emailVerified);
          } catch {}
        }
      });
    };

    setupAuth();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeToken) unsubscribeToken();
      if (sessionTimeout) clearTimeout(sessionTimeout);
    };
  }, []);

  useEffect(() => {
    if (user && !tokenRefreshRef.current) {
      tokenRefreshRef.current = setInterval(async () => {
        if (auth.currentUser) {
          try {
            const t = await auth.currentUser.getIdToken(true);
            await storeToken(t);
          } catch {}
        }
      }, 50 * 60 * 1000);
    }
    return () => {
      if (tokenRefreshRef.current) { clearInterval(tokenRefreshRef.current); tokenRefreshRef.current = null; }
    };
  }, [user]);

  const getFreshToken = async (): Promise<string | null> => {
    try {
      if (auth.currentUser) {
        const t = await auth.currentUser.getIdToken(true);
        await storeToken(t);
        return t;
      }
      return null;
    } catch { return null; }
  };

  const refreshDbUser = async (): Promise<DbUser | null> => {
    try {
      const backendUser = await userService.getUser();
      if (backendUser) {
        setDbUser(backendUser);
        const resolvedRole: UserRole = backendUser.is_chef ? "chef" : "customer";
        setRoleState(resolvedRole);
        await AsyncStorage.setItem(ROLE_KEY, resolvedRole);
      }
      return backendUser;
    } catch { return null; }
  };

  const signUp = async (
    email: string,
    password: string,
    userRole: UserRole,
    fullName?: string,
    additionalData?: Partial<UserRegisterRequest>,
    phone?: string,
    location?: SignUpLocationInput,
    profilePictureUrl?: string,
  ) => {
    const { user: firebaseUser, token: t, error } = await signUpWithEmail(email, password, userRole, fullName);
    if (error) return { error };
    if (t) await storeToken(t);
    await AsyncStorage.setItem(SESSION_FLAG_KEY, "1");
    setRoleState(userRole);
    await AsyncStorage.setItem(ROLE_KEY, userRole);
    try {
      const userData = {
        name: fullName || email.split("@")[0],
        email,
        phone: phone ?? "",
        is_customer: userRole === "customer",
        is_chef: userRole === "chef",
        status: "active",
        chef_profile: {
          kitchen_description: "",
          specialties: [],
          dietary_tags: [],
          documents: [],
          // profile_picture_url lives on chef_profile in the backend user model.
          ...(profilePictureUrl ? { profile_picture_url: profilePictureUrl } : {}),
        },
        location: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              address: location.address ?? "",
              is_primary: true,
            }
          : { latitude: 0, longitude: 0, address: "", is_primary: true },
        // additionalData still spreads last so existing callers keep overriding.
        ...additionalData,
        firebase_uid: firebaseUser!.uid,
      };
      const newUser = await userService.createUser(userData);
      setDbUser(newUser);
    } catch {}
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { token: t, error } = await signInWithEmail(email, password);
    if (error) return { error };
    if (t) await storeToken(t);
    await AsyncStorage.setItem(SESSION_FLAG_KEY, "1");
    return { error: null };
  };

  const handleGoogleSignIn = async (userRole: UserRole) => {
    const { token: t, error } = await signInWithGoogle(userRole);
    if (error) return { error };
    if (t) await storeToken(t);
    return { error: null };
  };

  const handleSignOut = async () => {
    await AsyncStorage.removeItem(SESSION_FLAG_KEY);
    await firebaseSignOut();
    setUser(null);
    setDbUser(null);
    setRoleState(null);
    setEmailVerified(null);
    setAuthError(null);
    await removeToken();
    await AsyncStorage.removeItem(ROLE_KEY);
    await AsyncStorage.removeItem(FCM_KEY);
  };

  const clearError = () => setAuthError(null);

  // Re-attempt backend verification after a network/5xx failure without forcing
  // a fresh sign-in. Used by the retry affordance surfaced from authError.
  const retryAuth = async () => {
    if (!auth.currentUser) {
      setAuthError({
        message: "No active session. Please sign in again.",
        code: "AUTH_ERROR",
        canRetry: false,
      });
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const backendUser = await userService.getUser();
      setDbUser(backendUser);
      const resolvedRole: UserRole = backendUser.is_chef ? "chef" : "customer";
      setRoleState(resolvedRole);
      await AsyncStorage.setItem(ROLE_KEY, resolvedRole);
    } catch (err: any) {
      if (err?.status === 404) {
        setAuthError({
          message: "Your account profile was not found. Please try again.",
          code: "NOT_FOUND",
          status: 404,
          canRetry: false,
        });
      } else {
        const ae = classifyAuthError(err);
        setAuthError(ae);
        if (ae.code === "AUTH_ERROR") await handleSignOut();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        role,
        loading,
        token,
        emailVerified,
        authError,
        clearError,
        retryAuth,
        signUp,
        signIn,
        signInWithGoogle: handleGoogleSignIn,
        signOut: handleSignOut,
        setRole: (r) => { setRoleState(r); if (r) AsyncStorage.setItem(ROLE_KEY, r); else AsyncStorage.removeItem(ROLE_KEY); },
        getFreshToken,
        refreshDbUser,
        sendPasswordReset,
        resendEmailVerification,
        checkEmailVerification: async () => {
          const result = await checkEmailVerification();
          if (result.isVerified !== null) setEmailVerified(result.isVerified);
          if (result.isVerified) {
            // Force-refresh token so backend sees email_verified:true, then re-sync user
            await getFreshToken();
            await refreshDbUser();
          }
          return result;
        },
        isChef: dbUser ? dbUser.is_chef : role === "chef",
        isCustomer: dbUser ? (dbUser.is_customer || role === "customer") : role === "customer",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
