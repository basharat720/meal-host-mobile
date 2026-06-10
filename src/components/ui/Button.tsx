import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from "react-native";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button = ({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? colors.primary : "#fff"} size="small" />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.destructive },

  size_sm: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm },
  size_md: { paddingHorizontal: spacing.md, paddingVertical: 11 },
  size_lg: { paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radius.lg },

  text: { fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  text_primary: { color: colors.primaryForeground },
  text_secondary: { color: colors.secondaryForeground },
  text_outline: { color: colors.primary },
  text_ghost: { color: colors.primary },
  text_destructive: { color: colors.destructiveForeground },

  textSize_sm: typography.sm,
  textSize_md: typography.base,
  textSize_lg: typography.md,
});
