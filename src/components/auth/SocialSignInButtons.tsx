import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { FACEBOOK_AUTH_ENABLED } from "@/constants/config";
import { isSignInCancelled, UserRole } from "@/integrations/firebase/auth";
import { spacing } from "@/constants/theme";

type Provider = "google" | "facebook";

interface Props {
  /** Role an account is created with if this email has none yet. */
  role: UserRole;
  mode: "signin" | "signup";
  /** Called after a successful sign-in; the screen decides where to go. */
  onSuccess: () => void;
}

/**
 * "Continue with Google" and, when a Facebook App ID is configured,
 * "Continue with Facebook". Shared by the four auth screens. Either button
 * signs into an existing account or creates one for `role` (see
 * completeSocialSignIn in AuthContext). Closing the provider's window is not
 * treated as a failure.
 */
export const SocialSignInButtons = ({ role, mode, onSuccess }: Props) => {
  const { signInWithGoogle, signInWithFacebook } = useAuth();
  const [busy, setBusy] = useState<Provider | null>(null);

  const run = async (provider: Provider) => {
    if (busy) return;
    setBusy(provider);
    const signIn = provider === "google" ? signInWithGoogle : signInWithFacebook;
    const { error } = await signIn(role);
    setBusy(null);
    if (!error) {
      onSuccess();
      return;
    }
    if (isSignInCancelled(error)) return;
    const label = provider === "google" ? "Google" : "Facebook";
    Alert.alert(`${label} ${mode === "signup" ? "Sign-Up" : "Sign-In"} Failed`, error.message);
  };

  return (
    <View style={styles.stack}>
      <Button
        variant="outline"
        onPress={() => run("google")}
        loading={busy === "google"}
        disabled={busy !== null}
      >
        Continue with Google
      </Button>
      {FACEBOOK_AUTH_ENABLED && (
        <Button
          variant="outline"
          onPress={() => run("facebook")}
          loading={busy === "facebook"}
          disabled={busy !== null}
        >
          Continue with Facebook
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
});
