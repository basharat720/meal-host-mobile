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

/** A numbered clause, e.g. "1.1 Chefs may join …". */
function Clause({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <Text style={styles.paragraph}>
      <Text style={styles.clauseNumber}>{n}</Text> {children}
    </Text>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>{"•"}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function ChefAgreementScreen() {
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
        <Text style={styles.headerTitle}>Partner Agreement</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="ribbon-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>FoodPal Partner Terms &amp; Payment Agreement</Text>
        </View>

        <Paragraph>
          This Agreement sets out the key commercial terms and conditions between Bridging People
          (SMC-Pvt limited) referred as FoodPal ("FoodPal", "we", "us") and the registered home
          chef ("Chef", "you") using the FoodPal platform.
        </Paragraph>
        <Paragraph>
          By registering as a Chef and accepting orders through FoodPal, you agree to the
          following terms.
        </Paragraph>

        <SectionTitle>1. Initial Three-Month Commission-Free Period</SectionTitle>
        <Clause n="1.1">
          Chefs may join FoodPal without paying any sign-up, registration, or membership fee
          during the initial three-month period.
        </Clause>
        <Clause n="1.2">
          The initial three-month period will begin on the official launch date of FoodPal for
          customers, being the date on which customers can begin placing orders through the
          platform. This date will be publicly communicated by FoodPal.
        </Clause>
        <Clause n="1.3">
          The three-month period applies equally to all Chefs onboarded under the initial launch
          offer, regardless of the date on which an individual Chef registered on the platform.
        </Clause>

        <SectionTitle>2. Chef Payment and Commission</SectionTitle>
        <Clause n="2.1">
          During the initial three-month period, FoodPal will charge 0% commission on completed
          orders.
        </Clause>
        <Clause n="2.2">
          During this period, the Chef will receive 100% of the applicable order value for
          successfully completed orders, subject to any refunds, cancellations, or other adjustments
          resulting from the Chef's actions or failure to fulfil an order.
        </Clause>
        <Clause n="2.3">
          Following the initial three-month period, FoodPal may introduce a fixed commission
          percentage on the applicable order value.
        </Clause>
        <Clause n="2.4">
          The applicable commission percentage and payment terms will be communicated to Chefs
          before they become effective.
        </Clause>
        <Clause n="2.5">
          Continued use of the FoodPal platform after the new commission structure takes effect
          constitutes acceptance of the updated commercial terms.
        </Clause>

        <SectionTitle>3. Delivery</SectionTitle>
        <Clause n="3.1">
          During the initial three-month period, FoodPal may assist Chefs with arranging or
          facilitating delivery where operationally feasible and geographically available.
        </Clause>
        <Clause n="3.2">
          FoodPal may introduce its own delivery service or engage third-party delivery partners
          in the future and may revise the delivery model accordingly.
        </Clause>

        <SectionTitle>4. Payments to Chefs</SectionTitle>
        <Clause n="4.1">
          Payments due to the Chef will be processed in accordance with FoodPal' payment and
          settlement procedures.
        </Clause>
        <Clause n="4.2">
          The Chef is responsible for providing accurate banking and payment information to receive
          payments.
        </Clause>
        <Clause n="4.3">
          The Chef is solely responsible for any applicable taxes, licences, registrations, permits,
          or other legal obligations relating to the Chef's income or business activities.
        </Clause>

        <SectionTitle>5. Changes and Termination</SectionTitle>
        <Clause n="5.1">
          FoodPal reserves the right to update these Terms and its commercial structure from time
          to time. Any material changes affecting commission or payment terms will be communicated
          to Chefs in advance.
        </Clause>
        <Clause n="5.2">
          FoodPal may suspend or terminate a Chef's access to the platform where there are serious
          food safety concerns, repeated customer complaints, fraudulent activity, repeated order
          cancellations, or any material breach of these Terms.
        </Clause>
        <Clause n="5.3">
          The Chef may stop using the FoodPal platform at any time, provided all accepted orders
          have been fulfilled and any outstanding financial obligations have been resolved.
        </Clause>

        <SectionTitle>6. Marketplace Role</SectionTitle>
        <Clause n="6.1">
          FoodPal operates solely as a digital marketplace connecting independent home chefs with
          customers.
        </Clause>
        <Clause n="6.2">
          FoodPal does not prepare, cook, package, store, transport, or own the food listed on the
          platform.
        </Clause>
        <Clause n="6.3">
          Each Chef acts as an independent seller and is solely responsible for the food they
          prepare and sell, including its quality, ingredients, preparation, packaging, labeling,
          food safety, and compliance with applicable laws and regulations.
        </Clause>

        <SectionTitle>7. Chef Responsibilities</SectionTitle>
        <Clause n="7.1">
          The Chef is responsible for preparing, handling, packaging, and storing all food in a
          safe, clean, and hygienic manner and for complying with all applicable food safety laws
          and regulations in the jurisdiction where the food is prepared and sold.
        </Clause>
        <Clause n="7.2">
          The Chef agrees to provide accurate and up-to-date information for each food listing,
          including, where applicable:
        </Clause>
        <Bullet>Food name and description</Bullet>
        <Bullet>Ingredients</Bullet>
        <Bullet>Portion size</Bullet>
        <Bullet>Price</Bullet>
        <Bullet>Quantity available</Bullet>
        <Bullet>Pickup time</Bullet>
        <Bullet>Dietary information (e.g. Halal, Vegetarian, Vegan, Kosher)</Bullet>
        <Bullet>Known allergens</Bullet>
        <Clause n="7.3">
          The Chef is responsible for ensuring that all photographs and descriptions uploaded to
          FoodPal accurately represent the food being offered.
        </Clause>
        <Clause n="7.4">
          The Chef agrees to prepare accepted orders in accordance with the order details and make
          them available for pickup within the agreed collection time.
        </Clause>
        <Clause n="7.5">
          The Chef shall promptly update or remove food listings that are no longer available and
          maintain accurate availability on the platform.
        </Clause>
        <Clause n="7.6">
          The Chef agrees to communicate professionally and respectfully with customers and
          FoodPal regarding orders, questions, and any issues that may arise.
        </Clause>
        <Clause n="7.7">
          The Chef is responsible for ensuring that any dietary or religious claims made about food
          listings, including but not limited to Halal, Vegetarian, and Vegan are accurate and
          truthful.
        </Clause>
        <Clause n="7.8">
          The Chef remains solely responsible for the quality, safety, ingredients, preparation,
          packaging, and legality of all food sold through the FoodPal platform.
        </Clause>

        <SectionTitle>8. Acceptance</SectionTitle>
        <Clause n="8.1">
          By registering as a Chef, electronically accepting these Terms, or accepting orders
          through the FoodPal platform, the Chef confirms that they have read, understood, and
          agree to be bound by these Terms.
        </Clause>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Legal Entity:</Text> This agreement is between the Chef and{" "}
            <Text style={styles.bold}>BRIDGING PEOPLE (SMC-PRIVATE) LIMITED</Text>, operating under
            the brand name "FoodPal".
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
  paragraph: {
    ...typography.base,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  clauseNumber: { fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  sectionTitle: {
    ...typography.xl,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  bulletRow: { flexDirection: "row", marginBottom: 6, paddingLeft: spacing.xs },
  bulletDot: { ...typography.base, color: colors.mutedForeground, marginRight: spacing.sm },
  bulletText: { ...typography.base, color: colors.mutedForeground, flex: 1 },
  bold: { fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  infoBox: {
    backgroundColor: colors.warmCream,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  infoText: { ...typography.base, color: colors.mutedForeground },
});
