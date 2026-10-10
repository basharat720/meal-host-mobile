/**
 * Delete Account — the confirmation screen behind Profile → Delete Account.
 *
 * A full screen rather than an Alert on purpose: a pop-up has room for a
 * sentence, and this decision needs a page. See
 * feature-docs/10-deleting-your-account.md.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { userService } from "@/services/userService";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

// Typing this unlocks the button. A deliberate speed bump — an accidental
// double-tap, a pocket or a child cannot close an account.
const CONFIRM_WORD = "DELETE";

function Bullet({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "destructive" }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, tone === "destructive" && styles.bulletDotDestructive]}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function DeleteAccountScreen() {
  const { dbUser, isChef, signOut } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!confirmed || deleting) return;
    setError(null);
    setDeleting(true);

    try {
      await userService.deleteAccount();
    } catch (e) {
      // The server's message is the useful one here — it names how many orders
      // are still in flight when that is what blocked the deletion.
      setError(e instanceof Error ? e.message : "Could not delete your account. Please try again.");
      setDeleting(false);
      return;
    }

    // The session is already dead server-side; clear it locally so the app does
    // not keep retrying with a token that will now be rejected.
    await signOut();

    // Browse-first, matching Sign Out: land on the public tab rather than a
    // login wall, so the app does not look broken on the way out.
    router.replace("/(tabs)/chefs");
    Alert.alert("Account deleted", "Your FoodPal account has been permanently deleted.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="warning-outline" size={48} color={colors.destructive} />
          <Text style={styles.pageTitle}>This cannot be undone</Text>
          {dbUser?.email ? <Text style={styles.subtitle}>{dbUser.email}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gone for good</Text>
          <Bullet tone="destructive">Your name, email, phone number and saved addresses</Bullet>
          <Bullet tone="destructive">Your saved chefs and dishes</Bullet>
          {isChef ? (
            <Bullet tone="destructive">
              Your kitchen, your dishes and your opening hours — removed from FoodPal the moment you
              confirm
            </Bullet>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kept, without your name on it</Text>
          <Bullet>
            Past orders and what was paid — they are the other side&apos;s receipt as well as yours
          </Bullet>
          <Bullet>Reviews you have written, shown from &quot;Deleted User&quot;</Bullet>
        </View>

        <Text style={styles.note}>
          You can sign up again later with the same email address, but it will be an empty account:
          your order history does not come back
          {isChef ? ", and you would need to be approved as a chef again" : ""}.
        </Text>

        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          editable={!deleting}
          error={error ?? undefined}
        />

        <Button
          variant="destructive"
          onPress={handleDelete}
          disabled={!confirmed}
          loading={deleting}
          style={styles.deleteBtn}
        >
          Delete My Account
        </Button>

        <Button
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          disabled={deleting}
        >
          Keep My Account
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 24, justifyContent: "center" },
  headerTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  content: { padding: spacing.md, paddingBottom: spacing["2xl"], gap: spacing.md },
  hero: { alignItems: "center", marginBottom: spacing.sm, gap: spacing.xs },
  pageTitle: {
    ...typography["2xl"],
    fontFamily: fonts.display,
    fontWeight: "800",
    color: colors.destructive,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  subtitle: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.base,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  bulletRow: { flexDirection: "row", gap: spacing.sm },
  bulletDot: { ...typography.base, color: colors.primary },
  bulletDotDestructive: { color: colors.destructive },
  bulletText: { ...typography.sm, fontFamily: fonts.sans, color: colors.foreground, flex: 1, lineHeight: 20 },
  note: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground, lineHeight: 20 },
  deleteBtn: { marginTop: spacing.xs },
});
