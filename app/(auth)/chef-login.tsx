import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography, fonts, radius } from "@/constants/theme";

// Web's gradient-secondary: hsl(12 85% 62%) → hsl(18 90% 55%)
const CHEF_GRADIENT: [string, string] = ["#F06D4C", "#F36325"];

export default function ChefLoginScreen() {
  const { signIn, signInWithGoogle, setRole } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const destination = (redirect as string) || "/(chef)/dashboard";

  const goBackOrHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email address";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
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
      setRole("chef");
      router.replace(destination as any);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle("chef");
    setIsGoogleLoading(false);
    if (error) Alert.alert("Google Sign-In Failed", error.message);
    else router.replace(destination as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <TouchableOpacity onPress={goBackOrHome} hitSlop={8} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>

          {/* Orange gradient hero header — mirrors web's gradient-secondary */}
          <LinearGradient colors={CHEF_GRADIENT} style={styles.hero} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
            <View style={styles.heroInner}>
              <View style={styles.chefBadge}>
                <MaterialCommunityIcons name="chef-hat" size={32} color="#fff" />
              </View>
              <Text style={styles.heroTitle}>Chef Portal</Text>
              <Text style={styles.heroSub}>Sign in to manage your kitchen</Text>
            </View>
            {/* Decorative circle */}
            <View style={styles.heroCircle} />
          </LinearGradient>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>Welcome back, chef!</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, email: undefined })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="chef@example.com"
              error={errors.email}
            />

            <View style={styles.passwordWrap}>
              <Input
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: undefined })); }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="••••••••"
                error={errors.password}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={styles.showPasswordBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.mutedForeground}
                />
                <Text style={styles.showPasswordText}>
                  {showPassword ? "Hide" : "Show"} password
                </Text>
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgot}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <Button
              onPress={handleLogin}
              loading={isLoading}
              style={styles.signInBtn}
              // Override button background to match chef orange
              textStyle={{ color: "#fff" }}
            >
              Sign In
            </Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button variant="outline" onPress={handleGoogleLogin} loading={isGoogleLoading}>
              Continue with Google
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New chef? </Text>
              <Link href="/(auth)/chef-signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Register here</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Are you a customer? </Text>
              <Link href="/(auth)/customer-login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Customer sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  backButton: {
    position: "absolute", top: 48, left: spacing.md, zIndex: 10,
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
  },

  // Hero header
  hero: {
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  heroInner: { alignItems: "center", gap: spacing.sm },
  chefBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: "#fff",
    marginTop: spacing.xs,
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: "rgba(255,255,255,0.82)",
  },
  heroCircle: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // Form
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -20,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  formTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },

  passwordWrap: { gap: 6 },
  showPasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  showPasswordText: { ...typography.sm, color: colors.mutedForeground },

  forgot: { alignSelf: "flex-end" },
  forgotText: { ...typography.sm, color: colors.accent, fontFamily: fonts.sansSemiBold },

  signInBtn: { backgroundColor: CHEF_GRADIENT[1] },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.sm, color: colors.mutedForeground },

  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.accent, fontFamily: fonts.sansBold },
});
