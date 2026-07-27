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

export default function TermsScreen() {
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
        <Text style={styles.headerTitle}>Terms &amp; Conditions</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="document-text-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Terms and Conditions</Text>
          <Text style={styles.updated}>Last Updated: July 19, 2026</Text>
        </View>

        <Paragraph>
          These terms and conditions govern your use of the websites and mobile applications
          provided by Bridging People (SMC-Private) Limited (or referred to as "Pakwanhus", "we" or
          us) (collectively the "Platform").
        </Paragraph>
        <Paragraph>
          By accessing or using Pakwanhus, you agree to these Terms and Conditions.
        </Paragraph>

        <SectionTitle>1. About Pakwanhus</SectionTitle>
        <Paragraph>
          Pakwanhus acts as a technology and service platform connecting customers and home chefs
          for providing homemade food. We enable customers to discover, order, and enjoy food
          prepared by independent home chefs.
        </Paragraph>
        <Paragraph>
          Pakwanhus works to onboard and support quality home chefs but does not prepare food itself
          unless specifically stated.
        </Paragraph>
        <Paragraph>
          All photos and images uploaded on Pakwanhus are for illustrative purposes only and may be
          different from the actual food delivered.
        </Paragraph>

        <SectionTitle>2. Home Chefs</SectionTitle>
        <Paragraph>Home chefs registered on Pakwanhus are responsible for:</Paragraph>
        <Bullet>Preparing food according to the information provided on their profile</Bullet>
        <Bullet>Maintaining appropriate hygiene and food preparation standards</Bullet>
        <Bullet>
          Ensuring that food descriptions, ingredients, and availability information are accurate
        </Bullet>

        <SectionTitle>3. Food Information &amp; Allergies</SectionTitle>
        <Paragraph>
          Customers are responsible for reviewing available food information before placing orders.
          Customers should inform the home chef of any known allergies or dietary restrictions
          before ordering.
        </Paragraph>
        <Paragraph>
          While home chefs make reasonable efforts to provide accurate information, Pakwanhus cannot
          guarantee that food products are completely free from allergens. The customer must
          therefore carefully read the dish description before ordering. Pakwanhus does not take any
          responsibility if the customer faces allergic reactions after consuming the food ordered
          at Pakwanhus.
        </Paragraph>

        <SectionTitle>4. Orders &amp; Payments</SectionTitle>
        <Paragraph>
          When customers place an order, they agree to provide accurate order and delivery
          information. Orders are subject to chef acceptance and once accepted, food preparation may
          begin after order confirmation and payment.
        </Paragraph>
        <Paragraph>
          Prices displayed on Pakwanhus are determined by home chefs and may include applicable
          service or delivery charges.
        </Paragraph>

        <SectionTitle>5. Custom Orders</SectionTitle>
        <Paragraph>
          Pakwanhus provides customers the ability to request customized dishes and special orders
          from selected home chefs. Custom orders may require additional preparation time and
          confirmation from the home chef before acceptance. Cancellation for custom orders can be
          made within 120 minutes of placing the order.
        </Paragraph>

        <SectionTitle>6. Delivery</SectionTitle>
        <Paragraph>
          Delivery timelines are estimates and may vary due to traffic conditions, weather, Chef
          preparation time, delivery availability, other unforeseen circumstances.
        </Paragraph>
        <Paragraph>Customers should ensure someone is available to receive the order.</Paragraph>

        <SectionTitle>7. User Responsibilities</SectionTitle>
        <Paragraph>Users agree not to:</Paragraph>
        <Bullet>Provide false information</Bullet>
        <Bullet>Misuse the platform</Bullet>
        <Bullet>Harass or abuse home chefs, delivery partners, or Pakwanhus staff</Bullet>
        <Bullet>Attempt fraudulent activities</Bullet>
        <Paragraph>
          In case of any misuse of the platform, Pakwanhus reserves the right to use legal channels
          to seek justice.
        </Paragraph>

        <SectionTitle>8. Platform Rights</SectionTitle>
        <Paragraph>Pakwanhus reserves the right to:</Paragraph>
        <Bullet>Suspend accounts violating our policies</Bullet>
        <Bullet>Remove listings that do not meet our quality standards</Bullet>
        <Bullet>Modify platform features and services</Bullet>

        <SectionTitle>9. Limitation of Liability</SectionTitle>
        <Paragraph>
          Pakwanhus facilitates connections between customers and home chefs. While we work to
          maintain quality and trust, food preparation remains the responsibility of individual home
          chefs.
        </Paragraph>

        <SectionTitle>10. Governing Law</SectionTitle>
        <Paragraph>
          These Terms and Conditions shall be governed by applicable laws of Islamic Republic of
          Pakistan.
        </Paragraph>

        <SectionTitle>Return Policy</SectionTitle>
        <Paragraph>
          Due to the nature of food products, we do not accept returns of delivered food items once
          the order has been received by the customer.
        </Paragraph>
        <Paragraph>
          To process your refund, you must contact Pakwanhus Customer Support immediately and no
          later than 60 minutes after receiving your order. Our team will review the reported
          concern and work with both customer and home chef to find an appropriate resolution.
        </Paragraph>
        <Paragraph>Customers may be requested to provide:</Paragraph>
        <Bullet>Order details</Bullet>
        <Bullet>Photos/videos of the received food (where applicable)</Bullet>
        <Bullet>Any relevant information to help us investigate the issue</Bullet>
        <Paragraph>
          Pakwanhus reserves the right to evaluate each complaint individually and determine the
          appropriate resolution.
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
