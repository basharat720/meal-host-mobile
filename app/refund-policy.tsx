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

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.iconRow}>
      <Ionicons
        name="checkmark-circle"
        size={20}
        color={colors.success}
        style={styles.rowIcon}
      />
      <Text style={styles.iconText}>{children}</Text>
    </View>
  );
}

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.iconRow}>
      <Ionicons
        name="close-circle"
        size={20}
        color={colors.destructive}
        style={styles.rowIcon}
      />
      <Text style={styles.iconText}>{children}</Text>
    </View>
  );
}

export default function RefundPolicyScreen() {
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
        <Text style={styles.headerTitle}>Refund Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="cash-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Refund Policy</Text>
          <Text style={styles.updated}>Last Updated: July 19, 2026</Text>
        </View>

        <Paragraph>
          Refunds are considered in situations where the issue is verified and falls under our refund
          criteria.
        </Paragraph>

        <SectionTitle>When Refunds Are Provided</SectionTitle>
        <Paragraph>A refund may be provided in cases including:</Paragraph>
        <View style={styles.approveBox}>
          <CheckItem>Order cancellation is accepted before food preparation begins</CheckItem>
          <CheckItem>
            Order not delivered due to an error attributable to FoodPal or the assigned delivery
            process
          </CheckItem>
          <CheckItem>Incorrect order delivered</CheckItem>
          <CheckItem>Significant quality issues confirmed by FoodPal representative</CheckItem>
          <CheckItem>Payment deducted but order was not successfully placed</CheckItem>
        </View>

        <SectionTitle>When Refunds Are Not Provided</SectionTitle>
        <View style={styles.denyBox}>
          <CrossItem>Customer is unavailable at delivery location</CrossItem>
          <CrossItem>Incorrect delivery address provided by the customer</CrossItem>
          <CrossItem>Delayed consumption or improper storage after delivery</CrossItem>
          <CrossItem>
            Taste preferences or personal dislike where the food matches the order description
          </CrossItem>
        </View>

        <SectionTitle>Refund Processing</SectionTitle>
        <Paragraph>
          Approved refunds will be processed through the original payment method within the time
          stipulated by the bank. For cash payments, FoodPal may provide refunds through an agreed
          alternative method. Refund processing time may vary depending on the payment provider or
          banking partner.
        </Paragraph>

        <SectionTitle>How to Request a Refund</SectionTitle>
        <View style={styles.infoBox}>
          <Text style={styles.infoTextStrong}>To process your refund request:</Text>
          <Bullet>Contact FoodPal Customer Support immediately</Bullet>
          <Bullet>
            Report the issue <Text style={styles.bold}>no later than 60 minutes</Text> after
            receiving your order
          </Bullet>
          <Bullet>
            Provide order details and supporting evidence (photos/videos if applicable)
          </Bullet>
          <Bullet>
            Our team will review and work with both parties to find an appropriate resolution
          </Bullet>
          <View style={styles.divider} />
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Contact:</Text> contact@foodpal.co
          </Text>
        </View>

        <SectionTitle>Return Policy</SectionTitle>
        <Paragraph>
          Due to the nature of food products, we do not accept returns of delivered food items once
          the order has been received by the customer. All refund requests must be made through our
          customer support team following the process outlined above.
        </Paragraph>
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
  iconRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  rowIcon: { marginRight: spacing.sm, marginTop: 2 },
  iconText: { ...typography.base, color: colors.mutedForeground, flex: 1 },
  approveBox: {
    backgroundColor: colors.successSubtle,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  denyBox: {
    backgroundColor: colors.status.cancelled.bg,
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
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
  infoTextStrong: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  contactName: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
});
