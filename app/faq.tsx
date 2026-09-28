import React, { useState } from "react";
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

type Faq = { question: string; answer: string };
type FaqCategory = { category: string; questions: Faq[] };

const faqData: FaqCategory[] = [
  {
    category: "About FoodPal",
    questions: [
      {
        question: "What is FoodPal?",
        answer:
          "FoodPal is a platform that connects you with talented home chefs offering authentic homemade food. We help you enjoy delicious meals prepared with care, tradition, and fresh ingredients.",
      },
      {
        question: "What does FoodPal mean?",
        answer:
          "A pal is a friend, and that is how we think about food: something shared, made by someone nearby who cooks it the way they would for their own family. Hence our slogan — Your Food is a Pal Away.",
      },
      {
        question: "Is FoodPal a restaurant?",
        answer:
          "No. FoodPal is a platform connecting customers with independent home chefs who prepare food from their own kitchens.",
      },
    ],
  },
  {
    category: "Ordering & Payments",
    questions: [
      {
        question: "How do I place an order?",
        answer:
          "Simply browse available home chefs and dishes, select your preferred items, choose your delivery details, and place your order through the FoodPal platform.",
      },
      {
        question: "Can I order a dish that is not on the menu?",
        answer:
          "Yes. One of our unique features is custom ordering. Customers can request specific dishes, portions, or occasions outside the standard menu. Selected home chefs can accept and prepare these personalized requests.",
      },
      {
        question: "Can I order food for a specific time?",
        answer:
          "Yes. Customers can request preferred delivery times where available. Home chefs will confirm availability based on preparation requirements.",
      },
      {
        question: "Can I order food for events or gatherings?",
        answer:
          "Yes. Many home chefs can prepare larger quantities for family gatherings, office events, celebrations, and special occasions. We recommend placing larger orders in advance.",
      },
      {
        question: "What payment methods are available?",
        answer:
          "Payment options may include available online payment methods and cash payment options depending on location and availability.",
      },
    ],
  },
  {
    category: "Delivery & Timing",
    questions: [
      {
        question: "What if my order arrives late?",
        answer:
          "Delivery times are estimates. If your order is delayed, please contact FoodPal support and we will assist you.",
      },
      {
        question: "What if I receive the wrong order?",
        answer:
          "Please contact customer support within 2 hours of delivery. We will review the issue and help resolve it.",
      },
    ],
  },
  {
    category: "Cancellations & Refunds",
    questions: [
      {
        question: "Can I cancel my order?",
        answer:
          "Cancellation depends on the preparation status of your order. Orders that have already entered preparation may not be eligible for cancellation. For custom orders, cancellation can be made within 120 minutes of placing the order.",
      },
      {
        question: "How do I request a refund?",
        answer:
          "To process a refund, you must contact FoodPal Customer Support immediately and no later than 60 minutes after receiving your order. Our team will review the reported concern and work with both customer and home chef to find an appropriate resolution.",
      },
      {
        question: "When are refunds provided?",
        answer:
          "Refunds may be provided for: order cancellation before food preparation begins, order not delivered due to FoodPal error, incorrect order delivered, significant quality issues confirmed by FoodPal representative, or payment deducted but order not placed.",
      },
      {
        question: "When are refunds NOT provided?",
        answer:
          "Refunds will not be provided if: customer is unavailable at delivery location, incorrect delivery address provided by customer, delayed consumption or improper storage after delivery, or taste preferences/personal dislike where food matches the order description.",
      },
    ],
  },
  {
    category: "Home Chefs",
    questions: [
      {
        question: "Who are the home chefs on FoodPal?",
        answer:
          "Our home chefs are passionate food creators who prepare authentic meals from their homes, bringing traditional recipes and personal cooking styles to customers.",
      },
      {
        question: "How does FoodPal ensure food quality?",
        answer:
          "We support home chefs by promoting good hygiene practices, accurate food descriptions, and customer feedback. We continuously work to improve trust and quality across our platform.",
      },
      {
        question: "Can anyone become a home chef?",
        answer:
          "Interested home chefs can apply through FoodPal. Each application is reviewed before confirming the chefs to sign up and upload their menus.",
      },
    ],
  },
  {
    category: "Trust & Safety",
    questions: [
      {
        question: "Are home chefs verified?",
        answer:
          "FoodPal reviews home chef applications before onboarding and continuously monitors customer feedback.",
      },
      {
        question: "How can I provide feedback?",
        answer:
          "After your order, you can share your experience through ratings and feedback. Your feedback helps us improve and supports quality home chefs.",
      },
      {
        question: "What about food allergies?",
        answer:
          "Customers are responsible for reviewing available food information before placing orders and should inform the home chef of any known allergies or dietary restrictions before ordering. While home chefs make reasonable efforts to provide accurate information, FoodPal cannot guarantee that food products are completely free from allergens.",
      },
    ],
  },
];

function AccordionItem({ faq }: { faq: Faq }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.accItem}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.accTrigger}
        accessibilityRole="button"
        accessibilityLabel={faq.question}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.accQuestion}>{faq.question}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? <Text style={styles.accAnswer}>{faq.answer}</Text> : null}
    </View>
  );
}

export default function FaqScreen() {
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
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="help-circle-outline" size={48} color={colors.primary} />
          <Text style={styles.pageTitle}>Frequently Asked Questions</Text>
          <Text style={styles.updated}>Find answers to common questions about FoodPal</Text>
        </View>

        {faqData.map((category) => (
          <View key={category.category}>
            <SectionTitle>{category.category}</SectionTitle>
            {category.questions.map((faq) => (
              <AccordionItem key={faq.question} faq={faq} />
            ))}
          </View>
        ))}

        <SectionTitle>Still Have Questions?</SectionTitle>
        <Paragraph>
          Can't find what you're looking for? Our support team is here to help!
        </Paragraph>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Email:</Text> contact@pakwanhus.com
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
  updated: { ...typography.sm, color: colors.mutedForeground, textAlign: "center" },
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
  accItem: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  accTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  accQuestion: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
    flex: 1,
  },
  accAnswer: {
    ...typography.base,
    color: colors.mutedForeground,
    paddingBottom: spacing.md,
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
  contactName: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
});
