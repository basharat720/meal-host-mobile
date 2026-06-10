import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert("Please enter your email"); return; }
    setIsLoading(true);
    const { error } = await sendPasswordReset(email.trim());
    setIsLoading(false);
    if (error) Alert.alert("Error", error.message);
    else setSent(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.container}>
          {sent ? (
            <View style={styles.successContainer}>
              <Text style={styles.emoji}>📧</Text>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We sent a password reset link to {email}. Check your inbox and follow the instructions.
              </Text>
              <Button onPress={() => router.back()} style={styles.button}>Back to Login</Button>
            </View>
          ) : (
            <>
              <Text style={styles.emoji}>🔑</Text>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@example.com"
                containerStyle={{ marginTop: spacing.lg }}
              />
              <Button onPress={handleReset} loading={isLoading} style={styles.button}>Send Reset Link</Button>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  back: { padding: spacing.md },
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  successContainer: { alignItems: "center" },
  emoji: { fontSize: 56, textAlign: "center", marginBottom: spacing.md },
  title: { ...typography["2xl"], fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: spacing.sm },
  subtitle: { ...typography.base, color: colors.mutedForeground, textAlign: "center", marginBottom: spacing.lg },
  button: { marginTop: spacing.lg },
});
