import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, typography } from "@/constants/theme";

type Variant = "default" | "success" | "warning" | "destructive" | "outline";

export const Badge = ({ label, variant = "default" }: { label: string; variant?: Variant }) => (
  <View style={[styles.base, styles[variant]]}>
    <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, alignSelf: "flex-start" },
  text: { ...typography.xs, fontWeight: "600" },

  default: { backgroundColor: colors.muted },
  success: { backgroundColor: "#DCFCE7" },
  warning: { backgroundColor: "#FEF9C3" },
  destructive: { backgroundColor: "#FEE2E2" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },

  text_default: { color: colors.mutedForeground },
  text_success: { color: "#166534" },
  text_warning: { color: "#92400E" },
  text_destructive: { color: "#991B1B" },
  text_outline: { color: colors.foreground },
});
