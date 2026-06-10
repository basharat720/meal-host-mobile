import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";

export default function OrderSuccessScreen() {
  const router = useRouter();

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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Status</Text>
            <Text style={styles.infoStatus}>Confirmed</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.progressNote}>Chef is preparing your food</Text>
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
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    ...typography.base,
    color: colors.mutedForeground,
  },
  infoStatus: {
    ...typography.base,
    fontWeight: "700",
    color: colors.success,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.xs,
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
