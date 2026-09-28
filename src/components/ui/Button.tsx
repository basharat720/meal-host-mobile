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

// The brand guideline draws four button treatments: blue on white (`outline`),
// white on blue (`primary`), orange on white (`accentOutline`) and white on
// orange (`secondary`). `ghost` and `destructive` are carried over for the
// screens that already use them. Mirrors buttonVariants in
// meal-host-frontend/src/components/ui/button.tsx.
type Variant = "primary" | "secondary" | "outline" | "accentOutline" | "ghost" | "destructive";
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
        <ActivityIndicator color={variant === "outline" || variant === "ghost"
            ? colors.primary
            : variant === "accentOutline"
            ? colors.secondaryStrong
            : colors.white} size="small" />
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
    // Brand shape language: buttons are fully rounded pills at every size.
    borderRadius: radius.full,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: colors.primary },
  // Solid orange uses secondaryStrong, not the raw brand orange: white text on
  // #FF3903 measures ~3.6:1, under the WCAG AA floor.
  secondary: { backgroundColor: colors.secondaryStrong },
  outline: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.primary },
  accentOutline: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.secondaryStrong },
  ghost: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.destructive },

  size_sm: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  size_md: { paddingHorizontal: spacing.lg, paddingVertical: 11 },
  size_lg: { paddingHorizontal: spacing.xl, paddingVertical: 14 },

  text: { fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  text_primary: { color: colors.primaryForeground },
  text_secondary: { color: colors.secondaryForeground },
  text_outline: { color: colors.primary },
  text_accentOutline: { color: colors.secondaryStrong },
  text_ghost: { color: colors.primary },
  text_destructive: { color: colors.destructiveForeground },

  textSize_sm: typography.sm,
  textSize_md: typography.base,
  textSize_lg: typography.md,
});
