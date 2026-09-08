import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { validatePhoneNumber } from "@/lib/phone";
import { colors, spacing, typography, fonts, radius } from "@/constants/theme";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { SOCIAL_AUTH_ENABLED } from "@/constants/config";
import { Logo } from "@/components/Logo";

type Coords = { latitude: number; longitude: number };

// Phone is optional for customers; validate format only when provided.
// Optional for customers, but validated against its own country when given.
const validatePhone = (phone: string): string | null =>
  validatePhoneNumber(phone, false).error ?? null;

export default function CustomerSignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    else if (name.trim().length < 2) e.name = "Name must be at least 2 characters";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    const phoneError = validatePhone(phone);
    if (phoneError) e.phone = phoneError;
    if (!address.trim()) e.address = "Address is required";
    else if (address.trim().length < 5) e.address = "Address is too short";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Return coordinates for the typed address, forward-geocoding if needed.
  const resolveCoords = async (): Promise<Coords | null> => {
    if (coords) return coords;
    try {
      const results = await Location.geocodeAsync(address.trim());
      if (results?.[0]) {
        const c = { latitude: results[0].latitude, longitude: results[0].longitude };
        setCoords(c);
        return c;
      }
    } catch {}
    return null;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    const resolved = await resolveCoords();
    if (!resolved) {
      setIsLoading(false);
      setErrors((prev) => ({ ...prev, address: "Could not find that address. Please enter a more specific address or use your current location." }));
      return;
    }
    const { error } = await signUp(
      email.trim(),
      password,
      "customer",
      name.trim(),
      // The backend only persists acceptance on a chef record, but record it
      // here too so customer acceptance isn't lost if that ever changes.
      { terms_accepted: acceptedTerms, terms_accepted_at: new Date().toISOString() },
      phone || undefined,
      { latitude: resolved.latitude, longitude: resolved.longitude, address: address.trim() },
    );
    setIsLoading(false);
    if (error) {
      Alert.alert("Sign Up Failed", getUserFriendlyError(error));
    } else {
      router.replace("/(auth)/verify-email");
    }
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle("customer");
    setIsGoogleLoading(false);
    if (error) Alert.alert("Google Sign-Up Failed", error.message);
    else router.replace("/(tabs)/chefs");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size="lg" showText={true} variant="customer" />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join Pakwanhus as a customer</Text>
          </View>

          <View style={styles.form}>
            <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" error={errors.name} />
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} containerStyle={{ marginTop: spacing.md }} />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" error={errors.password} containerStyle={{ marginTop: spacing.md }} />
            <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" error={errors.confirmPassword} containerStyle={{ marginTop: spacing.md }} />
            <PhoneInput label="Phone Number (optional)" value={phone} onChangeText={setPhone} error={errors.phone} containerStyle={{ marginTop: spacing.md }} />

            <LocationAutocomplete
              label="Address"
              required
              focusOnLahore
              placeholder="Search for your address..."
              defaultValue={address}
              error={errors.address}
              onLocationSelect={(loc) => {
                setAddress(loc.label);
                setCoords({ latitude: loc.lat, longitude: loc.lon });
                setErrors((prev) => { const n = { ...prev }; delete n.address; return n; });
              }}
              containerStyle={{ marginTop: spacing.md }}
            />
            {coords && <Text style={styles.locationHint}>Location set ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})</Text>}

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAcceptedTerms((v) => !v)} activeOpacity={0.7}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text style={styles.termsLink} onPress={() => router.push("/terms" as any)}>Terms & Conditions</Text>
                {" "}and{" "}
                <Text style={styles.termsLink} onPress={() => router.push("/privacy")}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <Button onPress={handleSignup} loading={isLoading} disabled={!acceptedTerms} style={styles.button}>Create Account</Button>

            {SOCIAL_AUTH_ENABLED && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Button variant="outline" onPress={handleGoogleSignup} loading={isGoogleLoading}>Continue with Google</Button>
              </>
            )}
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
  locationHint: { ...typography.xs, color: colors.mutedForeground, marginTop: 4 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.lg },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1, ...typography.sm, color: colors.mutedForeground, lineHeight: 20 },
  termsLink: { color: colors.primary, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.sm, color: colors.mutedForeground },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.primary, fontWeight: "700" },
});
