import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
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

export default function HowItWorksScreen() {
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
        <Text style={styles.headerTitle}>How It Works</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="restaurant-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Why Pakwanhus?</Text>
          <Text style={styles.updated}>From home kitchens</Text>
        </View>

        <Paragraph>
          We connect passionate home chefs with people craving authentic homemade food — creating
          opportunities for chefs and better meals for customers.
        </Paragraph>

        <SectionTitle>For Chefs</SectionTitle>
        <SubTitle>Expand customer base</SubTitle>
        <Paragraph>Reach more customers beyond your local network.</Paragraph>
        <SubTitle>Scaling business</SubTitle>
        <Paragraph>Grow your culinary business at your own pace.</Paragraph>
        <SubTitle>Free digital marketing</SubTitle>
        <Paragraph>
          Get discovered through our platform without marketing costs.
        </Paragraph>

        <SectionTitle>For Customers</SectionTitle>
        <SubTitle>Affordable and authentic food</SubTitle>
        <Paragraph>
          Enjoy homemade quality at better prices than restaurants.
        </Paragraph>
        <SubTitle>Flexible and convenient</SubTitle>
        <Paragraph>Order when you want, delivered to your doorstep.</Paragraph>
        <SubTitle>Custom orders</SubTitle>
        <Paragraph>
          Accept special requests and showcase your creativity.
        </Paragraph>

        <SectionTitle>How It Works</SectionTitle>
        <Paragraph>
          Getting delicious homemade food is simple. Just follow these steps:
        </Paragraph>

        <SubTitle>1. Browse Chefs</SubTitle>
        <Paragraph>
          Explore talented home chefs near you and discover their menus of freshly prepared
          homemade dishes.
        </Paragraph>

        <SubTitle>2. Order Your Favorites</SubTitle>
        <Paragraph>
          Select the dishes you love, customize your order, and choose your delivery details.
        </Paragraph>

        <SubTitle>3. Track Your Order</SubTitle>
        <Paragraph>
          Follow your order in real time as your chosen home chef prepares your meal with care.
        </Paragraph>

        <SubTitle>4. Enjoy Your Food</SubTitle>
        <Paragraph>
          Receive your freshly cooked meal at your doorstep and savor authentic homemade goodness.
        </Paragraph>

        <SectionTitle>Ready to Taste Homemade Goodness?</SectionTitle>
        <Paragraph>Start exploring home chefs near you.</Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Tip:</Text> Head to the Chefs section to find home chefs
            available in your area.
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
