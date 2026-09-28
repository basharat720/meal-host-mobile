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

export default function PrivacyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Privacy Policy</Text>
          <Text style={styles.updated}>Last Updated: July 19, 2026</Text>
        </View>

        <Paragraph>
          Welcome to FoodPal ("FoodPal", "we", "our", or "us").
        </Paragraph>
        <Paragraph>
          Your privacy matters to us. This Privacy Policy explains how we collect, use, disclose,
          store and protect your personal information when you access or use our website, mobile
          application, or any services offered by FoodPal (collectively, the "Platform").
        </Paragraph>
        <Paragraph>
          By creating an account or using the Platform, you acknowledge that you have read and
          understood this Privacy Policy and agree to the collection and use of your information as
          described herein.
        </Paragraph>

        <SectionTitle>1. Who We Are</SectionTitle>
        <Paragraph>
          FoodPal is an online marketplace that connects customers with independent home chefs
          offering freshly prepared homemade meals.
        </Paragraph>
        <Paragraph>
          For the purposes of this Privacy Policy, FoodPal acts as the data controller for the
          personal information collected through the Platform.
        </Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            If you have any questions regarding this Privacy Policy, you may contact us at:
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Email:</Text> contact@pakwanhus.com
          </Text>
        </View>

        <SectionTitle>2. Information We Collect</SectionTitle>
        <Paragraph>
          We collect information necessary to provide and improve our services. When you create an
          account or place an order, we may collect your personal information such as:
        </Paragraph>
        <Bullet>Full name</Bullet>
        <Bullet>Mobile number</Bullet>
        <Bullet>Email address</Bullet>
        <Bullet>Delivery address</Bullet>
        <Bullet>Profile photograph (optional)</Bullet>
        <Bullet>Date of birth (where required)</Bullet>
        <Bullet>Account credentials</Bullet>

        <SubTitle>For Home Chefs</SubTitle>
        <Paragraph>We may also collect:</Paragraph>
        <Bullet>CNIC or other identification documents</Bullet>
        <Bullet>Kitchen/business information</Bullet>
        <Bullet>Bank or payment details</Bullet>
        <Bullet>Food licenses or certifications (where applicable)</Bullet>
        <Bullet>Profile photographs</Bullet>
        <Bullet>Menu and pricing information</Bullet>

        <SubTitle>Order Information</SubTitle>
        <Paragraph>When you place an order, we collect:</Paragraph>
        <Bullet>Ordered dishes</Bullet>
        <Bullet>Quantity</Bullet>
        <Bullet>Delivery instructions</Bullet>
        <Bullet>Preferred delivery time</Bullet>
        <Bullet>Order history</Bullet>
        <Bullet>Payment status</Bullet>
        <Bullet>Custom order requests</Bullet>
        <Bullet>Customer ratings and reviews</Bullet>

        <SectionTitle>3. Payment Information</SectionTitle>
        <Paragraph>Payments are processed through secure third-party payment providers.</Paragraph>
        <Paragraph>
          <Text style={styles.bold}>
            FoodPal does not store your complete debit or credit card information on its own
            servers.
          </Text>
        </Paragraph>

        <SectionTitle>4. Device Information</SectionTitle>
        <Paragraph>When you use our Platform, we may automatically collect:</Paragraph>
        <Bullet>Device type</Bullet>
        <Bullet>Browser information</Bullet>
        <Bullet>IP address</Bullet>
        <Bullet>Operating system</Bullet>
        <Bullet>Device identifiers</Bullet>
        <Bullet>App version</Bullet>
        <Bullet>Date and time of access</Bullet>

        <SectionTitle>5. Location Information</SectionTitle>
        <Paragraph>With your permission, we may collect your location to:</Paragraph>
        <Bullet>Display nearby home chefs</Bullet>
        <Bullet>Calculate delivery distance</Bullet>
        <Bullet>Improve delivery accuracy</Bullet>
        <Bullet>Provide location-based services</Bullet>
        <Paragraph>
          <Text style={styles.italic}>
            You may disable location access through your device settings at any time.
          </Text>
        </Paragraph>

        <SectionTitle>6. How We Use Your Information</SectionTitle>
        <Paragraph>We use your information to:</Paragraph>
        <Bullet>Create and manage your account</Bullet>
        <Bullet>Process and deliver orders</Bullet>
        <Bullet>Connect customers with home chefs</Bullet>
        <Bullet>Process payments</Bullet>
        <Bullet>Verify home chef identities</Bullet>
        <Bullet>Respond to customer support requests</Bullet>
        <Bullet>Send order confirmations and updates</Bullet>
        <Bullet>Improve our products and services</Bullet>
        <Bullet>Detect fraud and misuse</Bullet>
        <Bullet>Comply with legal obligations</Bullet>
        <Bullet>Personalize your experience</Bullet>
        <Bullet>Recommend relevant home chefs and dishes</Bullet>
        <Bullet>Conduct research and analytics</Bullet>
        <Paragraph>
          Where you have given your consent, we may also send promotional offers, newsletters,
          discounts and marketing communications.
        </Paragraph>
        <Paragraph>
          <Text style={styles.italic}>
            You may opt out of marketing communications at any time.
          </Text>
        </Paragraph>

        <SectionTitle>7. Sharing Your Information</SectionTitle>
        <Paragraph>
          We only share your information where necessary to provide our services.
        </Paragraph>
        <SubTitle>With Home Chefs</SubTitle>
        <Paragraph>When you place an order, we share information including:</Paragraph>
        <Bullet>Name</Bullet>
        <Bullet>Contact number</Bullet>
        <Bullet>Delivery address</Bullet>
        <Bullet>Order details</Bullet>
        <Bullet>Special instructions</Bullet>
        <Paragraph>This information is shared solely to prepare and complete your order.</Paragraph>

        <SectionTitle>8. Delivery Partners</SectionTitle>
        <Paragraph>
          Where delivery services are used, we share information necessary for delivery, including:
        </Paragraph>
        <Bullet>Customer name</Bullet>
        <Bullet>Contact number</Bullet>
        <Bullet>Delivery address</Bullet>
        <Bullet>Order reference</Bullet>
        <Bullet>Delivery instructions</Bullet>

        <SectionTitle>9. Service Providers</SectionTitle>
        <Paragraph>
          We may share information with trusted third-party providers who assist us with:
        </Paragraph>
        <Bullet>Payment processing</Bullet>
        <Bullet>Cloud hosting</Bullet>
        <Bullet>Analytics</Bullet>
        <Bullet>SMS and email notifications</Bullet>
        <Bullet>Customer support</Bullet>
        <Bullet>Fraud prevention</Bullet>
        <Paragraph>
          These providers are permitted to use your information only to perform services on our
          behalf.
        </Paragraph>

        <SectionTitle>10. Legal Requirements</SectionTitle>
        <Paragraph>
          We may disclose your information where required by applicable law, court order, regulatory
          authority or governmental request, or where necessary to protect the rights, safety or
          security of FoodPal, our users or the public.
        </Paragraph>

        <SectionTitle>11. Custom Orders</SectionTitle>
        <Paragraph>FoodPal offers customers the ability to place custom food requests.</Paragraph>
        <Paragraph>
          Information you provide in relation to custom orders—including dietary preferences, event
          details, requested recipes, delivery schedules, and other instructions—will be shared only
          with the selected home chef for the purpose of fulfilling your request.
        </Paragraph>

        <SectionTitle>12. Ratings and Reviews</SectionTitle>
        <Paragraph>Customers may submit ratings and reviews after completing an order.</Paragraph>
        <Paragraph>These reviews may be publicly displayed on the Platform.</Paragraph>
        <Paragraph>
          FoodPal reserves the right to remove reviews that are false, abusive, defamatory,
          discriminatory, offensive or otherwise violate our policies.
        </Paragraph>

        <SectionTitle>13. Cookies and Similar Technologies</SectionTitle>
        <Paragraph>We use cookies and similar technologies to:</Paragraph>
        <Bullet>Keep you signed in</Bullet>
        <Bullet>Remember your preferences</Bullet>
        <Bullet>Improve website functionality</Bullet>
        <Bullet>Measure website performance</Bullet>
        <Bullet>Understand how users interact with our Platform</Bullet>
        <Bullet>Improve security</Bullet>
        <Paragraph>
          You can control cookie preferences through your browser settings. Some features of the
          Platform may not function properly if cookies are disabled.
        </Paragraph>

        <SectionTitle>14. Data Security</SectionTitle>
        <Paragraph>
          We implement appropriate administrative, technical and organizational safeguards to
          protect your personal information from unauthorized access, disclosure, alteration or
          destruction.
        </Paragraph>
        <Paragraph>
          While we strive to protect your information using commercially reasonable security
          measures, no internet transmission or electronic storage system is completely secure.
        </Paragraph>

        <SectionTitle>15. Data Retention</SectionTitle>
        <Paragraph>We retain your personal information only for as long as necessary to:</Paragraph>
        <Bullet>Provide our services</Bullet>
        <Bullet>Maintain transaction records</Bullet>
        <Bullet>Resolve disputes</Bullet>
        <Bullet>Prevent fraud</Bullet>
        <Bullet>Comply with legal, tax and regulatory obligations</Bullet>
        <Paragraph>
          When information is no longer required, it will be securely deleted or anonymized.
        </Paragraph>

        <SectionTitle>16. Your Rights</SectionTitle>
        <Paragraph>Subject to applicable law, you may request to:</Paragraph>
        <Bullet>Access your personal information</Bullet>
        <Bullet>Correct inaccurate information</Bullet>
        <Bullet>Update your profile</Bullet>
        <Bullet>Delete your account</Bullet>
        <Bullet>Withdraw marketing consent</Bullet>
        <Bullet>Request information about how your data is processed</Bullet>
        <Paragraph>
          <Text style={styles.italic}>
            Certain requests may be subject to verification of your identity.
          </Text>
        </Paragraph>

        <SectionTitle>17. Children's Privacy</SectionTitle>
        <Paragraph>
          FoodPal is intended for individuals who are at least{" "}
          <Text style={styles.bold}>18 years of age</Text> or otherwise legally capable of entering
          into binding agreements under applicable law.
        </Paragraph>
        <Paragraph>We do not knowingly collect personal information from children.</Paragraph>

        <SectionTitle>18. Third-Party Links</SectionTitle>
        <Paragraph>Our Platform may contain links to third-party websites or services.</Paragraph>
        <Paragraph>
          FoodPal is not responsible for the privacy practices or content of those third-party
          websites. We encourage you to review their respective privacy policies before providing
          any personal information.
        </Paragraph>

        <SectionTitle>19. International Data Transfers</SectionTitle>
        <Paragraph>
          Your information may be stored or processed using cloud service providers located in
          Pakistan or other jurisdictions where our trusted service providers operate.
        </Paragraph>
        <Paragraph>
          Where such transfers occur, FoodPal will take reasonable measures to ensure that your
          information remains protected in accordance with applicable laws.
        </Paragraph>

        <SectionTitle>20. Changes to this Privacy Policy</SectionTitle>
        <Paragraph>We may update this Privacy Policy from time to time.</Paragraph>
        <Paragraph>
          Any material changes will be posted on the Platform together with the updated effective
          date. Your continued use of the Platform after such changes constitutes acceptance of the
          revised Privacy Policy.
        </Paragraph>

        <SectionTitle>21. Contact Us</SectionTitle>
        <Paragraph>
          If you have any questions regarding this Privacy Policy or wish to exercise your privacy
          rights, please contact us at:
        </Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.contactName}>FoodPal</Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Email:</Text> contact@pakwanhus.com
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Website:</Text> www.pakwanhus.com
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
