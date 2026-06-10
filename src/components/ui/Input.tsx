import React from "react";
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = ({ label, error, containerStyle, style, ...props }: InputProps) => (
  <View style={[styles.container, containerStyle]}>
    {label && <Text style={styles.label}>{label}</Text>}
    <TextInput
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={colors.mutedForeground}
      {...props}
    />
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.foreground },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    ...typography.base,
    fontFamily: fonts.sans,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.destructive },
  error: { ...typography.xs, color: colors.destructive },
});
