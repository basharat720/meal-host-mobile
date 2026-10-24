import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { contactService } from "@/services/contactService";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const CONTACT_EMAIL = "contact@foodpal.co";
const SUPPORT_PHONE = "+92 304 3856448";
const OFFICE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=H.227+Sector+E+Askari-X+AOHC+Lahore+Pakistan";

/** Mirrors the backend's column widths (and the website's form), so an
 *  over-long field is caught here rather than coming back as a 422. */
const LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 254,
  subject: 150,
  message: 5000,
} as const;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  subject: "",
  message: "",
};

/** Deliberately permissive: the server does the real check. */
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validate = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};

  if (!form.firstName.trim()) errors.firstName = "Please tell us your first name.";
  else if (form.firstName.length > LIMITS.firstName)
    errors.firstName = `Please keep this under ${LIMITS.firstName} characters.`;

  if (form.lastName.length > LIMITS.lastName)
    errors.lastName = `Please keep this under ${LIMITS.lastName} characters.`;

  if (!form.email.trim()) errors.email = "We need an email address to reply to.";
  else if (!looksLikeEmail(form.email.trim()))
    errors.email = "That doesn't look like an email address.";
  else if (form.email.length > LIMITS.email) errors.email = "That address is too long.";

  if (form.subject.length > LIMITS.subject)
    errors.subject = `Please keep the subject under ${LIMITS.subject} characters.`;

  if (!form.message.trim()) errors.message = "Please write your message.";
  else if (form.message.length > LIMITS.message)
    errors.message = `Please keep your message under ${LIMITS.message.toLocaleString()} characters.`;

  return errors;
};

/** The enquiry form — the same fields, checks and copy as the website's. */
function ContactForm() {
  const { dbUser } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Prefill from the account as a starting point, not a lock. Only fills
  // blanks, so it never overwrites something already being typed.
  useEffect(() => {
    if (!dbUser) return;
    const [first = "", ...rest] = (dbUser.name ?? "").trim().split(/\s+/);
    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || first,
      lastName: prev.lastName || rest.join(" "),
      email: prev.email || dbUser.email || "",
    }));
  }, [dbUser]);

  const update = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as it is touched.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const remaining = LIMITS.message - form.message.length;

  const handleSubmit = async () => {
    setSubmitError(null);
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    try {
      await contactService.submit({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim() || undefined,
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setSentTo(form.email.trim());
      setForm(EMPTY_FORM);
      setErrors({});
    } catch (err) {
      // The spam guard is the one failure worth explaining precisely — it
      // clears by itself, and the phone number is the way round it.
      if (err instanceof ApiError && err.status === 429) {
        setSubmitError(
          `That's a few messages in a short time, so we've paused new ones for a little while. ` +
            `If it's urgent, please call ${SUPPORT_PHONE}.`
        );
      } else if (err instanceof ApiError && err.status === 422) {
        setSubmitError(
          "Something in the form wasn't accepted. Please check your details and try again."
        );
      } else {
        setSubmitError(
          `We couldn't send that just now. Please try again, or reach us on ${SUPPORT_PHONE} or ${CONTACT_EMAIL}.`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sentTo) {
    // The success panel takes the form's place: a cleared form next to a
    // "sent" message reads as if it failed and needs retyping.
    return (
      <View style={styles.successBox} accessibilityRole="summary" accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={36} color={colors.success} />
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successText}>
          Thanks — your message is with our team, and we've emailed a copy to{" "}
          <Text style={styles.successStrong}>{sentTo}</Text>.
        </Text>
        <Text style={styles.successText}>
          We aim to reply within 24 hours. If it's urgent, call us on{" "}
          <Text
            style={[styles.successStrong, styles.underline]}
            onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`)}
          >
            {SUPPORT_PHONE}
          </Text>
          .
        </Text>
        <Pressable onPress={() => setSentTo(null)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sendAnother}>Send another message</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.formCard}>
      <Input
        label="First Name"
        value={form.firstName}
        onChangeText={update("firstName")}
        placeholder="Ex. John"
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={LIMITS.firstName}
        error={errors.firstName}
      />
      <Input
        label="Last Name"
        value={form.lastName}
        onChangeText={update("lastName")}
        placeholder="Ex. Tailor"
        autoComplete="family-name"
        textContentType="familyName"
        maxLength={LIMITS.lastName}
        error={errors.lastName}
      />
      <Input
        label="Email Address"
        value={form.email}
        onChangeText={update("email")}
        placeholder="example@mail.com"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={LIMITS.email}
        error={errors.email}
      />
      <Input
        label="Subject"
        value={form.subject}
        onChangeText={update("subject")}
        placeholder="How can we help?"
        maxLength={LIMITS.subject}
        error={errors.subject}
      />
      <Input
        label="Comments / Questions"
        value={form.message}
        onChangeText={update("message")}
        placeholder="Your message..."
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        style={styles.messageInput}
        maxLength={LIMITS.message}
        error={errors.message}
        // Only worth showing once the ceiling is in sight.
        helperText={
          remaining < 500 ? `${remaining.toLocaleString()} characters left` : undefined
        }
      />

      {submitError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.destructive} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <Button
        variant="secondary"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submitBtn}
      >
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </View>
  );
}

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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Contact Us</Text>
          <Text style={styles.updated}>We're here to help</Text>
        </View>

        <Paragraph>
          Have questions or need assistance? We're here to help. Send us a message and our team
          will get back to you as soon as possible.
        </Paragraph>

        <ContactForm />

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
              onPress={() => Linking.openURL("mailto:contact@foodpal.co")}
            >
              contact@foodpal.co
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
          <Text style={styles.contactName}>FoodPal</Text>
          <Text style={styles.infoText}>H.227, Sector E</Text>
          <Text style={styles.infoText}>Askari-X, AOHC</Text>
          <Text style={styles.infoText}>Lahore, Pakistan</Text>
          <Text
            style={[styles.link, styles.mapsLink]}
            onPress={() => Linking.openURL(OFFICE_MAPS_URL)}
            accessibilityRole="link"
          >
            View on Google Maps
          </Text>
        </View>

        <SectionTitle>Need Help with an Order?</SectionTitle>
        <Paragraph>
          For refunds, cancellations, or anything that went wrong with a delivery, our policies
          spell out exactly what happens next — and how quickly.
        </Paragraph>
        <Button variant="outline" size="sm" onPress={() => router.push("/refund-policy")} style={styles.inlineBtn}>
          View Refund Policy
        </Button>

        <SectionTitle>Please Visit Our FAQs Before Contacting Us</SectionTitle>
        <Paragraph>
          Ordering, delivery, payments and chef requests — most answers are already written down,
          and you'll have them in seconds.
        </Paragraph>
        <Button variant="outline" size="sm" onPress={() => router.push("/faq")} style={styles.inlineBtn}>
          View FAQs
        </Button>

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
          your order for the fastest resolution
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
                Linking.openURL("https://www.facebook.com/share/1HZRxtpRao/?mibextid=wwXIfr")
              }
            >
              FoodPal
            </Text>
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Instagram:</Text>{" "}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL("https://www.instagram.com/foodpalco?srtk=OTk2OWhkMjc5bWcy")}
            >
              @foodpalco
            </Text>
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
  mapsLink: { ...typography.sm, marginTop: spacing.xs },
  inlineBtn: { alignSelf: "flex-start", marginTop: spacing.xs },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  messageInput: { minHeight: 130 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    backgroundColor: colors.destructiveSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { ...typography.sm, color: colors.destructive, flex: 1 },
  submitBtn: { alignSelf: "flex-start", paddingHorizontal: spacing.xl },
  successBox: {
    borderWidth: 2,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSubtle,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  successTitle: {
    ...typography.xl,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.successSubtleForeground,
  },
  successText: { ...typography.base, color: colors.successSubtleForeground },
  successStrong: { fontFamily: fonts.sansBold, fontWeight: "700" },
  underline: { textDecorationLine: "underline" },
  sendAnother: {
    ...typography.base,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
    marginTop: spacing.xs,
  },
  contactName: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
});
