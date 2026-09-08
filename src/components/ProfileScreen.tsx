import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/services/userService";
import type { UserLocationInput } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { uploadProfilePicture } from "@/services/imageService";
import { validatePhoneNumber } from "@/lib/phone";
import {
  fieldToNumber,
  numberToField,
  sanitizeNumericInput,
  validateNumericField,
} from "@/lib/profileFields";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Profile picture URL validation (mirrors web lib/profilePicture.ts)
// ---------------------------------------------------------------------------
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"];
const IMAGE_URL_EXTENSION_REGEX = new RegExp(
  `\\.(${ALLOWED_IMAGE_EXTENSIONS.join("|")})(?:$|[?#])`,
  "i"
);

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isCloudinaryImageDeliveryUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    const isCloudinaryHost =
      parsed.hostname === "res.cloudinary.com" ||
      parsed.hostname.endsWith(".res.cloudinary.com");
    const isImageDeliveryPath =
      parsed.pathname.includes("/image/upload/") ||
      parsed.pathname.includes("/image/private/") ||
      parsed.pathname.includes("/image/authenticated/");
    return isCloudinaryHost && isImageDeliveryPath;
  } catch {
    return false;
  }
};

const validateProfilePictureUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!isHttpUrl(trimmed)) {
    return "Profile picture URL must start with http:// or https://";
  }
  if (!IMAGE_URL_EXTENSION_REGEX.test(trimmed) && !isCloudinaryImageDeliveryUrl(trimmed)) {
    return "Profile picture URL must end with: jpg, jpeg, png, gif, webp, avif, or svg";
  }
  return null;
};

// Legal & About links — fixed routes owned by another unit this phase.
const LEGAL_LINKS: { label: string; icon: keyof typeof Ionicons.glyphMap; path: string }[] = [
  { label: "How It Works", icon: "help-buoy-outline", path: "/how-it-works" },
  { label: "FAQ", icon: "chatbubbles-outline", path: "/faq" },
  { label: "Contact Us", icon: "mail-outline", path: "/contact" },
  { label: "Privacy Policy", icon: "shield-checkmark-outline", path: "/privacy" },
  { label: "Terms of Service", icon: "document-text-outline", path: "/terms" },
  { label: "Refund Policy", icon: "cash-outline", path: "/refund-policy" },
];


// ---------------------------------------------------------------------------
// ProfileScreen component
// ---------------------------------------------------------------------------
export const ProfileScreen = () => {
  const { dbUser, user, isChef, signOut, refreshDbUser } = useAuth();

  const primaryLocation =
    dbUser?.locations?.find((l) => l.is_primary) ?? dbUser?.locations?.[0];

  const [name, setName] = useState(dbUser?.name ?? "");
  const [phone, setPhone] = useState(dbUser?.phone ?? "");
  const [address, setAddress] = useState(primaryLocation?.address ?? "");
  const [city, setCity] = useState(dbUser?.city ?? "");
  const [zip, setZip] = useState(dbUser?.zip_code ?? "");
  const [kitchenName, setKitchenName] = useState(
    dbUser?.chef_profile?.kitchen_name ?? dbUser?.name ?? ""
  );
  const [bio, setBio] = useState(dbUser?.chef_profile?.kitchen_description ?? "");
  const [specialties, setSpecialties] = useState(
    dbUser?.chef_profile?.specialties?.join(", ") ?? ""
  );
  const [experience, setExperience] = useState(
    numberToField(dbUser?.chef_profile?.years_of_experience)
  );
  const [deliveryRadius, setDeliveryRadius] = useState(
    numberToField(dbUser?.chef_profile?.delivery_radius_km)
  );
  const [cuisineTypes, setCuisineTypes] = useState(
    dbUser?.chef_profile?.dietary_tags?.join(", ") ?? ""
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    dbUser?.delivery_instructions ?? ""
  );
  const [profilePictureUrl, setProfilePictureUrl] = useState(
    dbUser?.chef_profile?.profile_picture_url ?? ""
  );
  const [profilePictureTouched, setProfilePictureTouched] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(
    primaryLocation
      ? { lat: primaryLocation.latitude, lon: primaryLocation.longitude }
      : null
  );
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync when dbUser loads (e.g. after navigation)
  useEffect(() => {
    if (!dbUser) return;
    const primary =
      dbUser.locations?.find((l) => l.is_primary) ?? dbUser.locations?.[0];
    setName(dbUser.name ?? "");
    setPhone(dbUser.phone ?? "");
    setAddress(primary?.address ?? "");
    setCity(dbUser.city ?? "");
    setZip(dbUser.zip_code ?? "");
    setDeliveryInstructions(dbUser.delivery_instructions ?? "");
    setLocationCoords(
      primary ? { lat: primary.latitude, lon: primary.longitude } : null
    );
    if (isChef && dbUser.chef_profile) {
      setKitchenName(dbUser.chef_profile.kitchen_name ?? dbUser.name ?? "");
      setBio(dbUser.chef_profile.kitchen_description ?? "");
      setSpecialties(dbUser.chef_profile.specialties?.join(", ") ?? "");
      setCuisineTypes(dbUser.chef_profile.dietary_tags?.join(", ") ?? "");
      setExperience(numberToField(dbUser.chef_profile.years_of_experience));
      setDeliveryRadius(numberToField(dbUser.chef_profile.delivery_radius_km));
      setProfilePictureUrl(dbUser.chef_profile.profile_picture_url ?? "");
    }
  }, [dbUser, isChef]);

  // ---------------------------------------------------------------------------
  // Pick profile picture
  // ---------------------------------------------------------------------------
  const pickProfilePicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    // Try to upload immediately
    setUploadingImage(true);
    try {
      const uid = user?.id ?? dbUser?.firebase_uid ?? "profile-user";
      const uploadedUrl = await uploadProfilePicture(uri, uid);
      setProfilePictureUrl(uploadedUrl);
      setProfilePictureTouched(true);
      setProfilePictureError(null);
      setLocalImageUri(null); // use remote URL
    } catch {
      // Fall back to showing locally only — user can still save (URL won't be sent if empty)
      setLocalImageUri(uri);
      Alert.alert(
        "Upload Failed",
        "Could not upload to cloud. The image is shown locally. You can paste a URL below instead."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Remove profile picture (clears it; the removal is persisted on save)
  // ---------------------------------------------------------------------------
  const removeProfilePicture = () => {
    setProfilePictureUrl("");
    setLocalImageUri(null);
    setProfilePictureTouched(true);
    setProfilePictureError(null);
  };

  // ---------------------------------------------------------------------------
  // Save profile
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!dbUser?.id) return;

    // Validate the profile picture URL before saving (mirrors web).
    if (isChef) {
      const picError = validateProfilePictureUrl(profilePictureUrl);
      setProfilePictureError(picError);
      if (picError) {
        Alert.alert("Invalid Image URL", picError);
        return;
      }

      // Bounds mirror the backend schema, so a bad value is caught here
      // instead of coming back as a 422.
      const numericError =
        validateNumericField(experience, {
          label: "Years of experience",
          min: 0,
          max: 100,
          integer: true,
        }) ??
        validateNumericField(deliveryRadius, {
          label: "Delivery radius",
          min: 0,
          max: 500,
        });
      if (numericError) {
        Alert.alert("Invalid Value", numericError);
        return;
      }
    }

    // A blank kitchen name falls back to the chef's own name on save, so only
    // a too-short value is worth blocking.
    if (isChef && kitchenName.trim() && kitchenName.trim().length < 3) {
      Alert.alert("Invalid Value", "Kitchen name must be at least 3 characters");
      return;
    }

    // Optional here, but validated against its own country when given.
    const phoneResult = validatePhoneNumber(phone, false);
    if (!phoneResult.isValid) {
      Alert.alert("Invalid Value", phoneResult.error!);
      return;
    }

    setSaving(true);
    try {
      // updateData allows an optional `location` alongside UserUpdate; the
      // payload passes it through to the backend (mirrors the web app, which
      // persists the primary location on save).
      type UpdatePayload = Parameters<typeof userService.updateUser>[1] & {
        location?: UserLocationInput;
      };

      const updateData: UpdatePayload = {
        name: name.trim(),
        phone: phone || undefined,
        city: city.trim(),
        zip_code: zip.trim(),
      };

      if (!isChef) {
        updateData.delivery_instructions = deliveryInstructions.trim();
      }

      // BUG FIX: previously the edited address + coordinates were never sent,
      // so address changes were silently lost. Geocode the typed address to
      // resolve coordinates and persist it as the user's primary location.
      const trimmedAddress = address.trim();
      let coords = locationCoords;
      if (trimmedAddress) {
        try {
          const geocoded = await Location.geocodeAsync(trimmedAddress);
          if (geocoded?.[0]) {
            coords = { lat: geocoded[0].latitude, lon: geocoded[0].longitude };
            setLocationCoords(coords);
          }
        } catch {
          // Keep any previously known coordinates if geocoding fails.
        }
        if (coords) {
          updateData.location = {
            latitude: coords.lat,
            longitude: coords.lon,
            address: trimmedAddress,
            is_primary: true,
          };
        }
      }

      if (isChef) {
        // Blank text fields are sent as null (an explicit clear); a value the
        // parser can make no number of is omitted so the stored one survives.
        const yearsOfExperience = fieldToNumber(experience);
        const deliveryRadiusKm = fieldToNumber(deliveryRadius);

        updateData.chef_profile = {
          // Blank falls back to the chef's own name rather than blocking a save.
          kitchen_name: kitchenName.trim() || name.trim(),
          kitchen_description: bio.trim(),
          ...(yearsOfExperience !== undefined
            ? { years_of_experience: yearsOfExperience }
            : {}),
          ...(deliveryRadiusKm !== undefined
            ? { delivery_radius_km: deliveryRadiusKm }
            : {}),
          specialties: specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          dietary_tags: cuisineTypes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          // `documents` is write-only on the backend (it maps to
          // food_safety_badge and is never echoed back), so echoing the read
          // value here would clear the chef's uploaded documents. Omitting the
          // key leaves them untouched.
          // When the picture has been touched, persist the change (clearing it
          // sends null so the removal sticks); otherwise leave it untouched.
          ...(profilePictureTouched
            ? { profile_picture_url: profilePictureUrl.trim() || null }
            : {}),
        };
      }

      await userService.updateUser(dbUser.id, updateData);
      // Pull the saved profile back so the form (and the rest of the app) shows
      // what the server actually stored rather than stale context data.
      await refreshDbUser();
      setProfilePictureTouched(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------------
  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          // Browse-first: after logout, return to the public landing tab (not
          // the login screen), matching the web app.
          router.replace("/(tabs)/chefs");
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Avatar display
  // ---------------------------------------------------------------------------
  const avatarUri = localImageUri ?? (profilePictureUrl || null);
  const initials = (name || dbUser?.name || "?").charAt(0).toUpperCase();

  // Legal & About links — public; shown whether or not the user is logged in.
  const legalSection = (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Legal & About</Text>
      {LEGAL_LINKS.map((link, i) => (
        <React.Fragment key={link.path}>
          {i > 0 && <View style={styles.linkDivider} />}
          <Pressable
            onPress={() => router.push(link.path as Href)}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
          >
            <View style={styles.linkLeft}>
              <View style={styles.linkIcon}>
                <Ionicons name={link.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.linkTitle}>{link.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );

  // Not logged in — show a sign-in prompt plus the public legal/about links.
  // Signing in returns the user here (see redirect param).
  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.gateHeader}>
          <Text style={styles.screenTitle}>My Profile</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.gateScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.signInGate}>
            <Ionicons name="person-circle-outline" size={56} color={colors.mutedForeground} />
            <Text style={styles.signInTitle}>Sign in to your account</Text>
            <Text style={styles.signInDesc}>
              Sign in to manage your profile and see your details.
            </Text>
            <Button
              size="lg"
              style={styles.signInButton}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/customer-login",
                  params: { redirect: "/(tabs)/profile" },
                })
              }
            >
              Sign In
            </Button>
          </View>
          <View style={styles.gateLegal}>{legalSection}</View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.screenTitle}>My Profile</Text>
            <Text style={styles.screenSubtitle}>
              {isChef ? "Manage your chef profile" : "Manage your account"}
            </Text>
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={isChef ? pickProfilePicture : undefined} style={styles.avatarWrap}>
              {uploadingImage ? (
                <View style={styles.avatarFallback}>
                  <ActivityIndicator color={colors.primaryForeground} />
                </View>
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </View>
              )}
              {isChef && (
                <View style={styles.cameraOverlay}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )}
            </Pressable>
            <Text style={styles.avatarName}>{name || dbUser?.name}</Text>
            <Text style={styles.avatarEmail}>{dbUser?.email ?? user?.email}</Text>
          </View>

          {/* Common fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>

            <Input
              label="Full Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Email"
              placeholder="Email"
              value={dbUser?.email ?? user?.email ?? ""}
              editable={false}
              style={styles.readOnly}
            />

            <PhoneInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
            />

            <LocationAutocomplete
              label={isChef ? "Kitchen Address" : "Address"}
              placeholder={
                isChef ? "Search for where you cook from..." : "Search for your address..."
              }
              focusOnLahore
              defaultValue={address}
              onLocationSelect={(loc) => {
                setAddress(loc.label);
                // Selecting a suggestion gives exact coordinates, so the save
                // no longer has to geocode the typed string.
                setLocationCoords({ lat: loc.lat, lon: loc.lon });
              }}
            />

            <Input
              label="City"
              placeholder="Your city"
              value={city}
              onChangeText={setCity}
            />

            <Input
              label="ZIP / Postal Code"
              placeholder="ZIP code"
              value={zip}
              onChangeText={setZip}
            />
          </View>

          {/* Customer quick links */}
          {!isChef && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Activity</Text>

              <Pressable
                onPress={() => router.push("/(tabs)/my-requests")}
                style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
              >
                <View style={styles.linkLeft}>
                  <View style={styles.linkIcon}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.linkTitle}>My Requests</Text>
                    <Text style={styles.linkSubtitle}>View your custom dish requests</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>

              <View style={styles.linkDivider} />

              <Pressable
                onPress={() => router.push("/(tabs)/post-request")}
                style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
              >
                <View style={styles.linkLeft}>
                  <View style={[styles.linkIcon, { backgroundColor: `${colors.accent}20` }]}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.linkTitle}>Post a Request</Text>
                    <Text style={styles.linkSubtitle}>Ask chefs to make your favourite dish</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {/* Chef-specific fields */}
          {isChef && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chef Information</Text>

              {/* Profile picture URL input (fallback if Cloudinary not configured) */}
              <Input
                label="Profile Picture URL"
                placeholder="https://example.com/photo.jpg"
                value={profilePictureUrl}
                onChangeText={(v) => {
                  setProfilePictureUrl(v);
                  setLocalImageUri(null);
                  setProfilePictureTouched(true);
                  setProfilePictureError(validateProfilePictureUrl(v));
                }}
                autoCapitalize="none"
                keyboardType="url"
                error={profilePictureError ?? undefined}
              />

              {(profilePictureUrl.trim().length > 0 || localImageUri) && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={removeProfilePicture}
                  style={styles.removePictureBtn}
                >
                  Remove Picture
                </Button>
              )}

              <Input
                label="Kitchen Name"
                placeholder="e.g. Ammi's Kitchen"
                value={kitchenName}
                onChangeText={setKitchenName}
                autoCapitalize="words"
              />
              <Text style={styles.fieldHint}>
                Shown to customers instead of your own name.
              </Text>

              <Input
                label="Kitchen Description (Bio)"
                placeholder="Tell customers about your cooking style…"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                style={{ textAlignVertical: "top", minHeight: 100 }}
              />

              <Input
                label="Specialties (comma-separated)"
                placeholder="Biryani, Karahi, Desserts"
                value={specialties}
                onChangeText={setSpecialties}
              />

              <Input
                label="Cuisine / Dietary Tags (comma-separated)"
                placeholder="Halal, Vegetarian, Gluten-Free"
                value={cuisineTypes}
                onChangeText={setCuisineTypes}
              />

              <Input
                label="Years of Experience"
                placeholder="e.g. 5"
                keyboardType="number-pad"
                value={experience}
                onChangeText={(v) => setExperience(sanitizeNumericInput(v))}
              />

              <Input
                label="Delivery Radius (km)"
                placeholder="e.g. 10"
                keyboardType="decimal-pad"
                value={deliveryRadius}
                onChangeText={(v) =>
                  setDeliveryRadius(sanitizeNumericInput(v, { allowDecimal: true }))
                }
              />
            </View>
          )}

          {/* Customer delivery preferences */}
          {!isChef && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Preferences</Text>

              <Input
                label="Delivery Instructions"
                placeholder="Gate code, landmarks, drop-off notes…"
                value={deliveryInstructions}
                onChangeText={setDeliveryInstructions}
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: "top", minHeight: 80 }}
              />
            </View>
          )}

          {/* Chef/customer mode — only for accounts holding both roles */}
          <RoleSwitcher />

          {/* Legal & About */}
          {legalSection}

          {/* Save button */}
          <Button onPress={handleSave} loading={saving} style={styles.saveBtn}>
            Save Profile
          </Button>

          {/* Sign out */}
          <Button variant="outline" onPress={handleSignOut} style={styles.signOutBtn}>
            Sign Out
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fieldHint: { ...typography.xs, color: colors.mutedForeground, marginTop: -4 },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 40 },

  headerSection: { gap: 4 },
  gateHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 4 },
  gateScroll: { paddingBottom: 40 },
  gateLegal: { paddingHorizontal: spacing.md },
  signInGate: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing["2xl"], paddingBottom: spacing.lg, gap: spacing.md },
  signInTitle: { ...typography.xl, fontFamily: fonts.display, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  signInDesc: { ...typography.base, fontFamily: fonts.sans, color: colors.mutedForeground, textAlign: "center" },
  signInButton: { marginTop: spacing.sm, alignSelf: "stretch" },
  screenTitle: { ...typography["2xl"], fontFamily: fonts.display, fontWeight: "700", color: colors.foreground },
  screenSubtitle: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },

  avatarSection: { alignItems: "center", gap: spacing.sm },
  avatarWrap: { position: "relative" },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { ...typography["2xl"], fontWeight: "700", color: colors.primaryForeground },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarName: { ...typography.lg, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  avatarEmail: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },

  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
    gap: spacing.md,
  },
  sectionTitle: { ...typography.base, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  readOnly: { backgroundColor: colors.muted, color: colors.mutedForeground },

  removePictureBtn: { alignSelf: "flex-start" },
  saveBtn: { marginTop: spacing.sm },
  signOutBtn: { borderColor: colors.destructive },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  linkRowPressed: { opacity: 0.6 },
  linkLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.lightSage,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: { ...typography.base, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.foreground },
  linkSubtitle: { ...typography.xs, fontFamily: fonts.sans, color: colors.mutedForeground },
  linkDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});
