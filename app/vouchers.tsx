import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VoucherCard } from "@/components/VoucherCard";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useActiveCheckoutVoucher } from "@/lib/activeCheckoutVoucher";
import { colors, spacing, typography } from "@/constants/theme";
import type { CheckoutVoucher } from "@/hooks/useCheckoutVoucher";

/**
 * Every offer for the basket, opened from checkout's "View all".
 *
 * Works on checkout's own voucher state (published through
 * lib/activeCheckoutVoucher.ts), so an offer applied here is applied to the
 * order; applying one goes straight back to checkout.
 * See feature-docs/16-vouchers-in-the-app.md.
 */
export default function VouchersScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const active = useActiveCheckoutVoucher();

  // Same voucher, but a successful Apply returns to checkout with it on.
  const voucher = useMemo<CheckoutVoucher | null>(
    () =>
      active && {
        ...active,
        apply: async (code: string) => {
          const ok = await active.apply(code);
          if (ok && router.canGoBack()) router.back();
          return ok;
        },
      },
    [active, router]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("vouchers.back")}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("vouchers.title")}</Text>
        <View style={{ width: 24 }} />
      </View>

      {voucher ? (
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <VoucherCard voucher={voucher} />
        </KeyboardAwareScrollView>
      ) : (
        // Reached without a checkout behind it (e.g. a restored app state):
        // there's no basket to price offers against.
        <View style={styles.empty}>
          <Ionicons name="pricetag-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>{t("vouchers.noCheckout")}</Text>
          <Button variant="outline" onPress={() => router.replace("/(tabs)/cart")}>
            {t("vouchers.goToCart")}
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.lg, fontWeight: "700", color: colors.foreground },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: { ...typography.base, color: colors.mutedForeground, textAlign: "center" },
});
