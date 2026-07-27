import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subTitle}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function ContactScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Contact Us</Text>
          <Text style={styles.updated}>We're here to help</Text>
        </View>

        <Paragraph>
          Have questions or need assistance? We're here to help! Reach out to our team and we'll get
          back to you as soon as possible.
        </Paragraph>

        <SectionTitle>Customer Service</SectionTitle>
        <Paragraph>
          Call us for any inquiries, support, or assistance with your orders.
        </Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Phone:</Text>{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("tel:+923043856448")}>
              +92 304 3856448
            </Text>
          </Text>
        </View>

        <SectionTitle>Email Support</SectionTitle>
        <Paragraph>Send us an email and we'll respond within 24 hours.</Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Email:</Text>{" "}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL("mailto:contact@pakwanhus.com")}
            >
              contact@pakwanhus.com
            </Text>
          </Text>
        </View>

        <SectionTitle>Business Hours</SectionTitle>
        <Paragraph>We're available to assist you during these hours.</Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Every Day:</Text> 9:00 AM - 1:00 AM
          </Text>
          <Text style={[styles.infoText, styles.italic]}>16 hours of service daily</Text>
        </View>

        <SectionTitle>Office Address</SectionTitle>
        <Paragraph>Visit us or send correspondence to:</Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.contactName}>Pakwanhus</Text>
          <Text style={styles.infoText}>H.227, Sector E</Text>
          <Text style={styles.infoText}>Askari-X, AOHC</Text>
          <Text style={styles.infoText}>Lahore, Pakistan</Text>
        </View>

        <SectionTitle>Response Time</SectionTitle>
        <Bullet>
          <Text style={styles.bold}>Phone inquiries:</Text> Immediate assistance during business
          hours (9 AM - 1 AM)
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Email inquiries:</Text> We aim to respond within 24 hours
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Order issues:</Text> Contact us within 60 minutes of receiving
          your order for fastest resolution
        </Bullet>

        <SectionTitle>Connect With Us</SectionTitle>
        <Paragraph>
          Follow us on social media for updates, special offers, and delicious food inspiration.
        </Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Facebook:</Text>{" "}
            <Text
              style={styles.link}
              onPress={() =>
                Linking.openURL("https://www.facebook.com/profile.php?id=61591270821942")
              }
            >
              Pakwanhus
            </Text>
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Instagram:</Text>{" "}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL("https://www.instagram.com/pakwanhus/")}
            >
              @pakwanhus
            </Text>
          </Text>
        </View>
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
  content: { padding: spacing.md, paddingBottom: spacing["2xl"] },
  hero: { alignItems: "center", marginBottom: spacing.lg, gap: spacing.xs },
  pageTitle: {
    ...typography["2xl"],
    fontFamily: fonts.display,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  updated: { ...typography.sm, color: colors.mutedForeground },
  paragraph: {
    ...typography.base,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.xl,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subTitle: {
    ...typography.md,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  bulletRow: { flexDirection: "row", marginBottom: 6, paddingLeft: spacing.xs },
  bulletDot: { ...typography.base, color: colors.mutedForeground, marginRight: spacing.sm },
  bulletText: { ...typography.base, color: colors.mutedForeground, flex: 1 },
  bold: { fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  italic: { fontStyle: "italic" },
  link: { color: colors.primary, fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  infoBox: {
    backgroundColor: colors.warmCream,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  infoText: { ...typography.base, color: colors.mutedForeground },
  contactName: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
});
