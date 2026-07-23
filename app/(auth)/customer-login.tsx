import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography, radius, fonts } from "@/constants/theme";
import { Logo } from "@/components/Logo";

export default function CustomerLoginScreen() {
  const { signIn, signInWithGoogle, setRole } = useAuth();
  // Where to go after a successful login. Set by the gate that sent the user
  // here (e.g. checkout, profile); falls back to the home feed.
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const destination = (redirect as string) || "/(tabs)/home";

  const goBackOrHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    const { error } = await signIn(email.trim(), password);
    setIsLoading(false);
    if (error) {
      Alert.alert("Login Failed", error.message);
    } else {
      setRole("customer"); // pin role so 404-handler never creates a chef account
      router.replace(destination as any);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle("customer");
    setIsGoogleLoading(false);
    if (error) Alert.alert("Google Sign-In Failed", error.message);
    else router.replace(destination as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBackOrHome} hitSlop={8} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size="lg" showText={true} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your customer account</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder="••••••••"
              error={errors.password}
              containerStyle={{ marginTop: spacing.md }}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.showPassword}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
              <Text style={styles.showPasswordText}>{showPassword ? "Hide" : "Show"} password</Text>
            </TouchableOpacity>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <Button onPress={handleLogin} loading={isLoading} style={styles.loginButton}>
              Sign In
            </Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button variant="outline" onPress={handleGoogleLogin} loading={isGoogleLoading} style={styles.googleButton}>
              Continue with Google
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/customer-signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.chefLink}>
            <Text style={styles.footerText}>Are you a chef? </Text>
            <Link href="/(auth)/chef-login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Chef sign in</Text>
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
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  backButton: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: spacing["2xl"], gap: spacing.md },
  title: { ...typography["3xl"], fontFamily: fonts.display, fontWeight: "700", color: colors.foreground, marginBottom: spacing.xs, marginTop: spacing.xs },
  subtitle: { ...typography.base, fontFamily: fonts.sans, color: colors.mutedForeground },
  form: { gap: 0 },
  showPassword: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-end" },
  showPasswordText: { ...typography.sm, color: colors.mutedForeground },
  forgotPassword: { alignSelf: "flex-end", marginTop: spacing.sm },
  forgotPasswordText: { ...typography.sm, color: colors.primary, fontWeight: "600" },
  loginButton: { marginTop: spacing.lg },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.sm, color: colors.mutedForeground },
  googleButton: {},
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  chefLink: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.primary, fontWeight: "700" },
});
