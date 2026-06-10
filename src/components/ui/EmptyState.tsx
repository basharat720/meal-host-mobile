import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "./Button";
import { colors, spacing, typography } from "@/constants/theme";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ icon = "🍽️", title, description, actionLabel, onAction }: EmptyStateProps) => (
  <View style={styles.container}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={styles.title}>{title}</Text>
    {description && <Text style={styles.description}>{description}</Text>}
    {actionLabel && onAction && (
      <Button onPress={onAction} style={styles.button}>{actionLabel}</Button>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.xl, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: spacing.sm },
  description: { ...typography.base, color: colors.mutedForeground, textAlign: "center", marginBottom: spacing.lg },
  button: { minWidth: 160 },
});
