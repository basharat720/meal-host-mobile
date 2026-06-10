import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography, fonts } from "@/constants/theme";
import { Logo } from "@/components/Logo";

export default function ChefSignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [kitchenDescription, setKitchenDescription] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const validateStep1 = () => {
    if (!name.trim()) { Alert.alert("Please enter your name"); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { Alert.alert("Invalid email address"); return false; }
    if (password.length < 6) { Alert.alert("Password must be at least 6 characters"); return false; }
    if (password !== confirmPassword) { Alert.alert("Passwords do not match"); return false; }
    return true;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    const { error } = await signUp(email.trim(), password, "chef", name.trim(), {
      chef_profile: {
        kitchen_description: kitchenDescription,
        specialties: specialties.split(",").map(s => s.trim()).filter(Boolean),
        dietary_tags: [],
        documents: [],
      },
    });
    setIsLoading(false);
    if (error) Alert.alert("Sign Up Failed", error.message);
    else router.replace("/(auth)/verify-email");
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle("chef");
    setIsGoogleLoading(false);
    if (error) Alert.alert("Google Sign-Up Failed", error.message);
    else router.replace("/(chef)/dashboard");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size="lg" showText={true} />
            <Text style={styles.title}>Become a Chef</Text>
            <Text style={styles.subtitle}>Step {step} of 2</Text>
          </View>

          {step === 1 ? (
            <View>
              <Input label="Full Name" value={name} onChangeText={setName} placeholder="Chef's name" autoCapitalize="words" />
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="chef@example.com" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" containerStyle={{ marginTop: spacing.md }} />

              <Button onPress={() => { if (validateStep1()) setStep(2); }} style={styles.button}>Next</Button>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <Button variant="outline" onPress={handleGoogleSignup} loading={isGoogleLoading}>Continue with Google</Button>
            </View>
          ) : (
            <View>
              <Input
                label="Kitchen Description"
                value={kitchenDescription}
                onChangeText={setKitchenDescription}
                placeholder="Tell customers about your kitchen..."
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: "top" }}
              />
              <Input
                label="Specialties (comma separated)"
                value={specialties}
                onChangeText={setSpecialties}
                placeholder="Biryani, Karahi, Desserts"
                containerStyle={{ marginTop: spacing.md }}
              />

              <View style={styles.row}>
                <Button variant="outline" onPress={() => setStep(1)} style={styles.backButton}>Back</Button>
                <Button onPress={handleSubmit} loading={isLoading} style={styles.submitButton}>Create Account</Button>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/chef-login" asChild>
              <TouchableOpacity><Text style={styles.footerLink}>Sign in</Text></TouchableOpacity>
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
  button: { marginTop: spacing.lg },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.sm, color: colors.mutedForeground },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  backButton: { flex: 1 },
  submitButton: { flex: 2 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.primary, fontWeight: "700" },
});
