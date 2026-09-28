import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

/**
 * The FoodPal logo, as supplied by the designer.
 *
 * The artwork is copied from `meal-host-frontend/src/assets/brand/` — the same
 * files the website and the rider app use. The wordmark is part of the image
 * rather than live text: set it in a webfont and it drifts away from the real
 * logo the moment the type stack changes.
 *
 * FoodPal has a single mark, so the logo no longer changes with who is signed
 * in. It used to: chefs got a chef's hat, customers crossed utensils, visitors
 * the app mark. `variant` is still accepted so the auth screens keep compiling,
 * but one brand means one logo — the screens themselves say who they are for.
 */
interface LogoProps {
  size?: "sm" | "md" | "lg";
  /** `false` shows the mark alone; `true` (default) the mark plus wordmark. */
  showText?: boolean;
  /** Light-ink artwork, for brand-blue, orange or dark surfaces. */
  dark?: boolean;
  /** @deprecated One brand, one mark. Kept so existing call sites still build. */
  variant?: "customer" | "chef" | "brand";
}

// Intrinsic artwork sizes, used to keep the aspect ratio exact rather than
// guessed: lockup 900x223, mark 360x384.
const LOCKUP_RATIO = 900 / 223;
const MARK_RATIO = 360 / 384;

const HEIGHTS = { sm: 26, md: 32, lg: 42 } as const;

const ART = {
  lockup: {
    blue: require("../../assets/brand/foodpal-lockup-blue.png"),
    white: require("../../assets/brand/foodpal-lockup-white.png"),
  },
  mark: {
    blue: require("../../assets/brand/foodpal-mark-blue.png"),
    white: require("../../assets/brand/foodpal-mark-white.png"),
  },
} as const;

export function Logo({ size = "md", showText = true, dark = false }: LogoProps) {
  const height = HEIGHTS[size];
  const tone = dark ? "white" : "blue";
  const source = showText ? ART.lockup[tone] : ART.mark[tone];
  const width = height * (showText ? LOCKUP_RATIO : MARK_RATIO);

  return (
    <View style={styles.row}>
      <Image
        source={source}
        style={{ width, height }}
        contentFit="contain"
        accessibilityLabel="FoodPal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
