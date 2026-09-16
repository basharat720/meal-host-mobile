import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { getUserFriendlyError } from "@/lib/errorMessages";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { checkEmailVerification, resendEmailVerification, emailVerified, user, isChef } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Start the countdown already running: registration sends the verification
  // email, and the backend enforces the same 60s per-address cooldown, so an
  // immediate resend would only earn a 429.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Keep the latest verification status in a ref so the poll interval
  // (set up once) always reads the freshest value without re-subscribing.
  const emailVerifiedRef = useRef(emailVerified);
  useEffect(() => {
    emailVerifiedRef.current = emailVerified;
  }, [emailVerified]);

  useEffect(() => {
    if (emailVerified) {
      if (isChef) router.replace("/(chef)/dashboard");
      else router.replace("/(tabs)/chefs");
    }
  }, [emailVerified, isChef]);

  // Silently poll verification status every 5 seconds until verified.
  const pollVerification = useCallback(async () => {
    if (emailVerifiedRef.current) return;
    try {
      await checkEmailVerification();
    } catch {
      // Ignore transient polling errors; the manual button surfaces failures.
    }
  }, [checkEmailVerification]);

  useEffect(() => {
    if (emailVerified) return;
    const interval = setInterval(() => {
      if (!emailVerifiedRef.current) pollVerification();
    }, 5000);
    return () => clearInterval(interval);
  }, [emailVerified, pollVerification]);

  // Countdown tick for the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setIsChecking(true);
    const { isVerified, error } = await checkEmailVerification();
    setIsChecking(false);
    if (error) { Alert.alert("Error", getUserFriendlyError(error)); return; }
    if (isVerified) {
      if (isChef) router.replace("/(chef)/dashboard");
      else router.replace("/(tabs)/chefs");
    } else {
      Alert.alert("Not Yet Verified", "Your email hasn't been verified yet. Please check your inbox and click the link.");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsResending(true);
    const { error } = await resendEmailVerification();
    setIsResending(false);
    if (error) Alert.alert("Error", error.message);
    else {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert("Email Sent", "Verification email resent. Please check your inbox.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification email to{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
          {"\n\n"}Click the link in the email to verify your account, then tap the button below.
        </Text>

        <Button onPress={handleCheck} loading={isChecking} style={styles.button}>
          I've Verified My Email
        </Button>
        <Button
          variant="ghost"
          onPress={handleResend}
          loading={isResending}
          disabled={cooldown > 0}
          style={styles.resendButton}
        >
          {cooldown > 0 ? `Resend Email (${cooldown}s)` : "Resend Email"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 72, marginBottom: spacing.lg },
  title: { ...typography["2xl"], fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: spacing.md },
  subtitle: { ...typography.base, color: colors.mutedForeground, textAlign: "center", lineHeight: 24, marginBottom: spacing.xl },
  email: { fontWeight: "700", color: colors.primary },
  button: { width: "100%", marginBottom: spacing.sm },
  resendButton: { width: "100%" },
});
