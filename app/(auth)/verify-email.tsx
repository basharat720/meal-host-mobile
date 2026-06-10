import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";

export default function VerifyEmailScreen() {
  const { checkEmailVerification, resendEmailVerification, emailVerified, user, isChef } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (emailVerified) {
      if (isChef) router.replace("/(chef)/dashboard");
      else router.replace("/(tabs)/home");
    }
  }, [emailVerified, isChef]);

  const handleCheck = async () => {
    setIsChecking(true);
    const { isVerified, error } = await checkEmailVerification();
    setIsChecking(false);
    if (error) { Alert.alert("Error", error.message); return; }
    if (isVerified) {
      if (isChef) router.replace("/(chef)/dashboard");
      else router.replace("/(tabs)/home");
    } else {
      Alert.alert("Not Yet Verified", "Your email hasn't been verified yet. Please check your inbox and click the link.");
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    const { error } = await resendEmailVerification();
    setIsResending(false);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Email Sent", "Verification email resent. Please check your inbox.");
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
        <Button variant="ghost" onPress={handleResend} loading={isResending} style={styles.resendButton}>
          Resend Email
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
