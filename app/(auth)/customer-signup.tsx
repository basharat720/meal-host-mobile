import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography, fonts } from "@/constants/theme";
import { Logo } from "@/components/Logo";

export default function CustomerSignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    const { error } = await signUp(email.trim(), password, "customer", name.trim());
    setIsLoading(false);
    if (error) {
      Alert.alert("Sign Up Failed", error.message);
    } else {
      router.replace("/(auth)/verify-email");
    }
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle("customer");
    setIsGoogleLoading(false);
    if (error) Alert.alert("Google Sign-Up Failed", error.message);
    else router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size="lg" showText={true} />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join MealHost as a customer</Text>
          </View>

          <View style={styles.form}>
            <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" error={errors.name} />
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} containerStyle={{ marginTop: spacing.md }} />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" error={errors.password} containerStyle={{ marginTop: spacing.md }} />
            <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" error={errors.confirmPassword} containerStyle={{ marginTop: spacing.md }} />

            <Button onPress={handleSignup} loading={isLoading} style={styles.button}>Create Account</Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button variant="outline" onPress={handleGoogleSignup} loading={isGoogleLoading}>Continue with Google</Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/customer-login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Are you a chef? </Text>
            <Link href="/(auth)/chef-signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Chef sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg },
  header: { alignItems: "center", marginVertical: spacing["2xl"], gap: spacing.md },
  title: { ...typography["3xl"], fontFamily: fonts.display, fontWeight: "700", color: colors.foreground },
  subtitle: { ...typography.base, fontFamily: fonts.sans, color: colors.mutedForeground },
  form: {},
  button: { marginTop: spacing.lg },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.sm, color: colors.mutedForeground },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.primary, fontWeight: "700" },
});
