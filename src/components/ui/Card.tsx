import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "@/constants/theme";

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.sm,
  },
});
