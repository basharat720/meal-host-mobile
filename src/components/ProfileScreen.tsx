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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { colors, fonts, radius, shadow, spacing, typography } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Cloudinary upload helper (same pattern as menu.tsx)
// ---------------------------------------------------------------------------
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

const uploadImageToCloudinary = async (uri: string, uid: string): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, "_");
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const formData = new FormData();
  formData.append("file", { uri, name: `profile.${ext}`, type: mimeType } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `profile-pictures/${safeUid}`);

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

// ---------------------------------------------------------------------------
// ProfileScreen component
// ---------------------------------------------------------------------------
export const ProfileScreen = () => {
  const { dbUser, user, isChef, signOut } = useAuth();

  const [name, setName] = useState(dbUser?.name ?? "");
  const [phone, setPhone] = useState(dbUser?.phone ?? "");
  const [address, setAddress] = useState(dbUser?.locations?.[0]?.address ?? "");
  const [bio, setBio] = useState(dbUser?.chef_profile?.kitchen_description ?? "");
  const [specialties, setSpecialties] = useState(
    dbUser?.chef_profile?.specialties?.join(", ") ?? ""
  );
  const [profilePictureUrl, setProfilePictureUrl] = useState(
    dbUser?.chef_profile?.profile_picture_url ?? ""
  );
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync when dbUser loads (e.g. after navigation)
  useEffect(() => {
    if (!dbUser) return;
    setName(dbUser.name ?? "");
    setPhone(dbUser.phone ?? "");
    setAddress(dbUser.locations?.[0]?.address ?? "");
    if (isChef && dbUser.chef_profile) {
      setBio(dbUser.chef_profile.kitchen_description ?? "");
      setSpecialties(dbUser.chef_profile.specialties?.join(", ") ?? "");
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
      const uploadedUrl = await uploadImageToCloudinary(uri, uid);
      setProfilePictureUrl(uploadedUrl);
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
  // Save profile
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!dbUser?.id) return;
    setSaving(true);
    try {
      const updateData: Parameters<typeof userService.updateUser>[1] = {
        name: name.trim(),
        phone: phone.trim() || undefined,
      };

      if (isChef) {
        updateData.chef_profile = {
          kitchen_description: bio.trim(),
          specialties: specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          dietary_tags: dbUser.chef_profile?.dietary_tags ?? [],
          documents: dbUser.chef_profile?.documents ?? [],
          ...(profilePictureUrl.trim()
            ? { profile_picture_url: profilePictureUrl.trim() }
            : {}),
        };
      }

      await userService.updateUser(dbUser.id, updateData);
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
          // Browse-first: after logout, return to the public home/discover feed
          // (not the login screen), matching the web app.
          router.replace("/(tabs)/home");
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Avatar display
  // ---------------------------------------------------------------------------
  const avatarUri = localImageUri ?? (profilePictureUrl || null);
  const initials = (name || dbUser?.name || "?").charAt(0).toUpperCase();

  // Not logged in — show a sign-in prompt instead of an empty profile form.
  // Signing in returns the user here (see redirect param).
  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.gateHeader}>
          <Text style={styles.screenTitle}>My Profile</Text>
        </View>
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

            <Input
              label="Phone"
              placeholder="+1 555 000 0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Address"
              placeholder="Your address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              style={{ textAlignVertical: "top", minHeight: 60 }}
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
                onChangeText={(v) => { setProfilePictureUrl(v); setLocalImageUri(null); }}
                autoCapitalize="none"
                keyboardType="url"
              />

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
            </View>
          )}

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
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 40 },

  headerSection: { gap: 4 },
  gateHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 4 },
  signInGate: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
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
