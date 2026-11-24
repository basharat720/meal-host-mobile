import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, typography, shadow } from "@/constants/theme";
import { useI18n } from "@/i18n/context";
import { fillTemplate } from "@/lib/template";
import type { CheckoutVoucher } from "@/hooks/useCheckoutVoucher";
import type { VoucherQuote } from "@/services/voucherService";

interface Props {
  voucher: CheckoutVoucher;
  /** Show only the first N offers (checkout shows 3); all when omitted. */
  maxOffers?: number;
  /** Shown as "View all" when there are more offers than `maxOffers`. */
  onViewAll?: () => void;
}

/**
 * Checkout's **Offers & vouchers** card: a code box, the offers running now
 * (usable ones with Apply, the rest greyed with the reason), and the applied
 * offer as a chip with Remove. See feature-docs/16-vouchers-in-the-app.md.
 */
export function VoucherCard({ voucher, maxOffers, onViewAll }: Props) {
  const { t, formatPrice } = useI18n();
  const [code, setCode] = useState("");
  const { applied, applyingCode } = voucher;
  const busy = applyingCode !== null;

  const applyTyped = async () => {
    if (await voucher.apply(code)) setCode("");
  };

  const offerTitle = (offer: VoucherQuote) => offer.title || offer.code || "";
  // The server sorts usable offers first, biggest saving first, so the top
  // few are the best ones for this basket.
  const shownOffers =
    maxOffers !== undefined ? voucher.offers.slice(0, maxOffers) : voucher.offers;
  const hiddenCount = voucher.offers.length - shownOffers.length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="pricetag-outline" size={18} color={colors.secondaryStrong} />
        <Text style={styles.title}>{t("vouchers.title")}</Text>
      </View>

      {/* Auto-applied offer, or a nudge for one the basket doesn't fit yet. */}
      {voucher.autoApplied && applied ? (
        <View style={styles.autoBanner} accessibilityLiveRegion="polite">
          <Ionicons name="gift" size={20} color={colors.primary} />
          <View style={styles.autoText}>
            <Text style={styles.autoTitle}>
              {applied.first_order_only
                ? t("vouchers.autoAppliedFirstOrder")
                : t("vouchers.autoApplied")}
            </Text>
            <Text style={styles.autoBody}>{applied.summary || applied.title}</Text>
            <Text style={styles.autoSaving}>
              {fillTemplate(t("vouchers.youSave"), {
                amount: formatPrice(applied.discount_amount),
              })}
            </Text>
          </View>
        </View>
      ) : null}
      {voucher.autoApplyHint ? (
        <View style={[styles.autoBanner, styles.autoHint]} accessibilityLiveRegion="polite">
          <Ionicons name="gift-outline" size={20} color={colors.primary} />
          <View style={styles.autoText}>
            <Text style={styles.autoTitle}>
              {t("vouchers.autoHintTitle")}: {offerTitle(voucher.autoApplyHint)}
            </Text>
            {voucher.autoApplyHint.summary ? (
              <Text style={styles.autoBody}>{voucher.autoApplyHint.summary}</Text>
            ) : null}
            {voucher.autoApplyHint.message ? (
              <Text style={styles.autoHintMessage}>{voucher.autoApplyHint.message}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {applied ? (
        <View style={styles.chip}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <View style={styles.chipText}>
            <Text style={styles.chipCode}>{applied.code}</Text>
            {applied.title ? <Text style={styles.chipTitle}>{applied.title}</Text> : null}
            <Text style={styles.chipSaving}>
              {fillTemplate(t("vouchers.youSave"), {
                amount: formatPrice(applied.discount_amount),
              })}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={voucher.remove}
            disabled={busy}
            textStyle={styles.removeText}
            accessibilityLabel={`${t("vouchers.remove")} ${applied.code ?? ""}`}
          >
            {t("vouchers.remove")}
          </Button>
        </View>
      ) : (
        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            placeholder={t("vouchers.codePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={applyTyped}
            editable={!busy}
            accessibilityLabel={t("vouchers.codePlaceholder")}
          />
          <Button
            variant="outline"
            size="sm"
            onPress={applyTyped}
            loading={busy && applyingCode === code.trim().toUpperCase()}
            disabled={busy || !code.trim()}
          >
            {t("vouchers.apply")}
          </Button>
        </View>
      )}

      {voucher.error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {voucher.error}
        </Text>
      ) : null}
      {voucher.notice ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warningSubtleForeground} />
          <Text style={styles.noticeText} accessibilityLiveRegion="polite">
            {voucher.notice}
          </Text>
        </View>
      ) : null}
      {voucher.isRevalidating ? (
        <Text style={styles.mutedText}>{t("vouchers.checking")}</Text>
      ) : null}
      {applied ? <Text style={styles.mutedText}>{t("vouchers.onePerOrder")}</Text> : null}

      <Text style={styles.listTitle}>{t("vouchers.availableOffers")}</Text>
      {voucher.offersLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text style={styles.mutedText}>{t("vouchers.loadingOffers")}</Text>
        </View>
      ) : voucher.offers.length === 0 ? (
        <Text style={styles.mutedText}>{t("vouchers.noOffers")}</Text>
      ) : (
        <View style={styles.offerList}>
          {shownOffers.map((offer) => {
            const isApplied = !!applied && applied.code === offer.code;
            return (
              <View
                key={offer.code ?? offerTitle(offer)}
                style={[
                  styles.offer,
                  isApplied && styles.offerApplied,
                  !offer.eligible && styles.offerIneligible,
                ]}
              >
                <View style={styles.offerText}>
                  <Text style={styles.offerTitle}>{offerTitle(offer)}</Text>
                  {offer.summary || offer.description ? (
                    <Text style={styles.offerSummary}>{offer.summary || offer.description}</Text>
                  ) : null}
                  {offer.code && offer.title ? (
                    <Text style={styles.offerCode}>{offer.code}</Text>
                  ) : null}
                  {offer.eligible ? (
                    <Text style={styles.offerSaving}>
                      {fillTemplate(t("vouchers.youSave"), {
                        amount: formatPrice(offer.discount_amount),
                      })}
                    </Text>
                  ) : offer.message ? (
                    <Text style={styles.offerReason}>{offer.message}</Text>
                  ) : null}
                </View>
                {offer.eligible ? (
                  isApplied ? (
                    <View style={styles.appliedBadge}>
                      <Text style={styles.appliedBadgeText}>{t("vouchers.applied")}</Text>
                    </View>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => offer.code && voucher.apply(offer.code)}
                      loading={applyingCode === offer.code}
                      disabled={busy || !offer.code}
                    >
                      {t("vouchers.apply")}
                    </Button>
                  )
                ) : null}
              </View>
            );
          })}
          {hiddenCount > 0 && onViewAll ? (
            <Pressable
              onPress={onViewAll}
              style={styles.viewAll}
              accessibilityRole="button"
              hitSlop={6}
            >
              <Text style={styles.viewAllText}>
                {fillTemplate(t("vouchers.viewAll"), { count: String(voucher.offers.length) })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.secondaryStrong} />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.sm,
    gap: spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.md, fontWeight: "700", color: colors.foreground },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  codeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    ...typography.base,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSubtle,
  },
  chipText: { flex: 1, gap: 1 },
  chipCode: { ...typography.sm, fontWeight: "700", color: colors.successSubtleForeground },
  chipTitle: { ...typography.xs, color: colors.foreground },
  chipSaving: { ...typography.xs, fontWeight: "600", color: colors.successSubtleForeground },
  removeText: { color: colors.destructive },
  autoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  autoHint: { backgroundColor: colors.card },
  autoText: { flex: 1, gap: 2 },
  autoTitle: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  autoBody: { ...typography.xs, color: colors.foreground },
  autoSaving: { ...typography.xs, fontWeight: "700", color: colors.success },
  autoHintMessage: { ...typography.xs, fontWeight: "600", color: colors.primary },
  errorText: { ...typography.sm, color: colors.destructive },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSubtle,
  },
  noticeText: { ...typography.xs, color: colors.warningSubtleForeground, flex: 1 },
  mutedText: { ...typography.xs, color: colors.mutedForeground },
  listTitle: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  offerList: { gap: spacing.sm },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  viewAllText: { ...typography.sm, fontWeight: "600", color: colors.secondaryStrong },
  offer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  offerApplied: { borderColor: colors.successBorder, backgroundColor: colors.successSubtle },
  offerIneligible: { opacity: 0.55, backgroundColor: colors.muted },
  offerText: { flex: 1, gap: 2 },
  offerTitle: { ...typography.sm, fontWeight: "600", color: colors.foreground },
  offerSummary: { ...typography.xs, color: colors.mutedForeground },
  offerCode: { ...typography.xs, fontWeight: "600", color: colors.primary, letterSpacing: 0.5 },
  offerSaving: { ...typography.xs, fontWeight: "600", color: colors.success },
  offerReason: { ...typography.xs, color: colors.foreground },
  appliedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  appliedBadgeText: { ...typography.xs, fontWeight: "700", color: colors.successForeground },
});
