import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, spacing, typography, fonts, radius } from "@/constants/theme";
import { Logo } from "@/components/Logo";

type Coords = { latitude: number; longitude: number };

// ---------------------------------------------------------------------------
// Cloudinary upload helper (same pattern as menu.tsx / ProfileScreen.tsx)
// ---------------------------------------------------------------------------
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

const uploadImageToCloudinary = async (uri: string, uploaderId: string): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }
  const safeId = uploaderId.replace(/[^a-zA-Z0-9]/g, "_") || "signup-user";
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const formData = new FormData();
  formData.append("file", { uri, name: `profile.${ext}`, type: mimeType } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `profile-pictures/${safeId}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Cloudinary upload failed (${res.status}): ${err?.error?.message ?? ""}`);
  }
  const data = await res.json();
  const url = data.secure_url || data.url;
  if (!url) throw new Error("Cloudinary response missing URL");
  return url as string;
};

// Phone is required for chefs; validate format.
const validatePhone = (phone: string): string | null => {
  if (!phone.trim()) return "Phone number is required for chefs";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return "Phone number must be at least 10 digits";
  if (digits.length > 15) return "Phone number is too long";
  return null;
};

export default function ChefSignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [kitchenDescription, setKitchenDescription] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The API takes a single name field, so the CNIC first/last names are joined.
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();

  const validateStep1 = () => {
    if (!firstName.trim()) { Alert.alert("Please enter your first name as per CNIC"); return false; }
    if (!lastName.trim()) { Alert.alert("Please enter your last name as per CNIC"); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { Alert.alert("Invalid email address"); return false; }
    if (password.length < 6) { Alert.alert("Password must be at least 6 characters"); return false; }
    if (password !== confirmPassword) { Alert.alert("Passwords do not match"); return false; }
    const phoneError = validatePhone(phone);
    if (phoneError) { Alert.alert(phoneError); return false; }
    return true;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!kitchenDescription.trim()) e.kitchenDescription = "Kitchen description is required for chefs";
    else if (kitchenDescription.trim().length < 20) e.kitchenDescription = "Kitchen description must be at least 20 characters";
    if (!profilePictureUrl && !localImageUri) e.profilePicture = "Profile picture is required for chefs";
    if (!address.trim()) e.address = "Address is required";
    else if (address.trim().length < 5) e.address = "Address is too short";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Pick + upload the chef profile picture.
  const pickProfilePicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setErrors((prev) => { const n = { ...prev }; delete n.profilePicture; return n; });

    setUploadingImage(true);
    try {
      const uploadedUrl = await uploadImageToCloudinary(uri, email || name || "signup-user");
      setProfilePictureUrl(uploadedUrl);
      setLocalImageUri(null);
    } catch {
      // Fall back to the local uri so the user can still proceed; this local
      // uri is passed as profile_picture_url when a remote upload isn't available.
      setProfilePictureUrl("");
      setLocalImageUri(uri);
      Alert.alert("Upload Failed", "Could not upload to cloud. The selected image will be used locally.");
    } finally {
      setUploadingImage(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Location permission is required to use your current location.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCoords(c);
      try {
        const places = await Location.reverseGeocodeAsync(c);
        const p = places?.[0];
        if (p) {
          const parts = [p.name, p.street, p.city, p.region, p.postalCode, p.country].filter(Boolean);
          if (parts.length) setAddress(parts.join(", "));
        }
      } catch {}
      setErrors((prev) => { const n = { ...prev }; delete n.address; return n; });
    } catch {
      Alert.alert("Location Error", "Could not get your current location. Please enter your address manually.");
    } finally {
      setLocating(false);
    }
  };

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

  const handleSubmit = async () => {
    if (!validateStep2()) return;
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
      "chef",
      name.trim(),
      {
        chef_profile: {
          kitchen_description: kitchenDescription.trim(),
          specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
          dietary_tags: [],
          documents: [],
        },
      },
      phone.trim(),
      { latitude: resolved.latitude, longitude: resolved.longitude, address: address.trim() },
      profilePictureUrl || localImageUri || undefined,
    );
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

  const previewUri = localImageUri || profilePictureUrl || null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Logo size="lg" showText={true} variant="chef" />
            <Text style={styles.title}>Become a Chef</Text>
            <Text style={styles.subtitle}>Step {step} of 2</Text>
          </View>

          {step === 1 ? (
            <View>
              <Input label="First name as per CNIC" value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
              <Input label="Last name as per CNIC" value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="chef@example.com" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" containerStyle={{ marginTop: spacing.md }} />
              <Input label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+92 300 1234567" containerStyle={{ marginTop: spacing.md }} />
              <Text style={styles.helpText}>Required for chefs. Include country code (e.g., +92 for Pakistan).</Text>

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
                error={errors.kitchenDescription}
              />
              <Text style={styles.helpText}>Minimum 20 characters.</Text>

              <Input
                label="Specialties (comma separated)"
                value={specialties}
                onChangeText={setSpecialties}
                placeholder="Biryani, Karahi, Desserts"
                containerStyle={{ marginTop: spacing.md }}
              />

              <Text style={styles.fieldLabel}>Chef Profile Picture</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickProfilePicture} disabled={uploadingImage} activeOpacity={0.7}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.imagePreview} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={colors.mutedForeground} />
                    <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                  </View>
                )}
                {uploadingImage && (
                  <View style={styles.imageOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              {errors.profilePicture && <Text style={styles.errorText}>{errors.profilePicture}</Text>}

              <Input
                label="Address"
                value={address}
                onChangeText={(t) => { setAddress(t); setCoords(null); }}
                placeholder="Street, city, region..."
                error={errors.address}
                containerStyle={{ marginTop: spacing.md }}
              />
              <TouchableOpacity style={styles.locationButton} onPress={useCurrentLocation} disabled={locating} activeOpacity={0.7}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.locationButtonText}>{locating ? "Getting location..." : "Use current location"}</Text>
              </TouchableOpacity>
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

              <View style={styles.row}>
                <Button variant="outline" onPress={() => setStep(1)} style={styles.backButton}>Back</Button>
                <Button onPress={handleSubmit} loading={isLoading} disabled={!acceptedTerms} style={styles.submitButton}>Create Account</Button>
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
  helpText: { ...typography.xs, color: colors.mutedForeground, marginTop: 4 },
  fieldLabel: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.foreground, marginTop: spacing.md, marginBottom: 6 },
  errorText: { ...typography.xs, color: colors.destructive, marginTop: 4 },
  imagePicker: {
    width: 112, height: 112, borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  imagePlaceholderText: { ...typography.xs, color: colors.mutedForeground },
  imageOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  locationButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  locationButtonText: { ...typography.sm, color: colors.primary, fontWeight: "600" },
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
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  backButton: { flex: 1 },
  submitButton: { flex: 2 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { ...typography.base, color: colors.mutedForeground },
  footerLink: { ...typography.base, color: colors.primary, fontWeight: "700" },
});
