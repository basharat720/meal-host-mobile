import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderIds?: string;
    eta?: string;
    chefName?: string;
  }>();

  const orderIds = (params.orderIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const etaLabel = params.eta?.trim() || null;
  const chefName = params.chefName?.trim() || null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>

        {/* Title & Subtitle */}
        <Text style={styles.title}>Order Placed! 🎉</Text>
        <Text style={styles.subtitle}>
          Your order has been received. You'll get an update from the chef soon.
        </Text>

        {/* Info Card */}
        <View style={styles.infoCard}>
          {orderIds.length > 0 ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {orderIds.length === 1 ? "Order ID" : "Order IDs"}
              </Text>
              <Text style={styles.infoValue}>
                {orderIds.map((id) => `#${id}`).join(", ")}
              </Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Status</Text>
            <Text style={styles.infoStatus}>Awaiting chef confirmation</Text>
          </View>

          {etaLabel ? (
            <View style={styles.etaBlock}>
              <Text style={styles.infoLabel}>Estimated ready</Text>
              <Text style={styles.etaValue}>{etaLabel}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.progressNote}>
            {chefName
              ? `${chefName} will confirm your order shortly`
              : "Waiting for the chef to confirm your order"}
            {etaLabel ? ` · ready in about ${etaLabel}` : ""}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            style={styles.actionButton}
            onPress={() => router.replace("/(tabs)/orders")}
          >
            View My Orders
          </Button>
          <Button
            variant="outline"
            size="lg"
            style={styles.actionButton}
            onPress={() => router.replace("/(tabs)/home")}
          >
            Back to Home
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  iconContainer: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    backgroundColor: `${colors.success}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography["3xl"],
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  subtitle: {
    ...typography.base,
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: "100%",
    ...shadow.md,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  infoLabel: {
    ...typography.base,
    color: colors.mutedForeground,
    flexShrink: 0,
  },
  infoStatus: {
    ...typography.base,
    fontWeight: "700",
    color: colors.success,
    flex: 1,
    textAlign: "right",
  },
  infoValue: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
    flex: 1,
    textAlign: "right",
  },
  etaBlock: {
    gap: 2,
  },
  etaValue: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
    flexWrap: "wrap",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    width: "25%",
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: radius.full,
  },
  progressNote: {
    ...typography.xs,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
  actionButton: {
    width: "100%",
  },
});
