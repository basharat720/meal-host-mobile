import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { colors, fonts, radius } from "@/constants/theme";
import { ChefHatIcon, UtensilsCrossedIcon } from "@/components/icons/BrandIcons";
import { useAuth } from "@/contexts/AuthContext";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  dark?: boolean;
  /**
   * Overrides the mark. Leave unset and it follows the signed-in user: chefs get the
   * cap, customers the crossed utensils, and visitors the full app mark from the splash.
   * Set it explicitly only where the screen's audience is known before sign-in —
   * the chef/customer login and signup screens.
   */
  variant?: "customer" | "chef" | "brand";
}

const SIZES = {
  sm: { box: 32, icon: 18, text: 18 },
  md: { box: 40, icon: 22, text: 22 },
  lg: { box: 52, icon: 28, text: 28 },
};

const VARIANTS = {
  customer: {
    Icon: UtensilsCrossedIcon,
    gradient: [colors.gradientPrimaryStart, colors.gradientPrimaryEnd],
  },
  chef: {
    Icon: ChefHatIcon,
    gradient: [colors.gradientSecondaryStart, colors.gradientSecondaryEnd],
  },
  brand: {
    // Light-ink app mark — the same asset the splash uses, so the two read as one.
    image: require("../../assets/splash-icon.png"),
    gradient: [colors.gradientPrimaryStart, colors.gradientPrimaryEnd],
  },
} as const;

export function Logo({ size = "md", showText = true, dark = false, variant }: LogoProps) {
  const { user, isChef } = useAuth();

  // Gate on `user` first: isChef falls back to a role cached in AsyncStorage, which can
  // outlive a session, and a signed-out visitor should always get the brand mark.
  const resolved = variant ?? (!user ? "brand" : isChef ? "chef" : "customer");

  const s = SIZES[size];
  const v = VARIANTS[resolved];
  const textColor = dark ? colors.dark.foreground : colors.foreground;

  return (
    <View style={styles.row}>
      <LinearGradient
        colors={v.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.box,
          {
            width: s.box,
            height: s.box,
            borderRadius: size === "lg" ? radius.lg : radius.md,
          },
        ]}
      >
        {"image" in v ? (
          // The asset carries its own padding, so size against the box, not the glyph size.
          <Image
            source={v.image}
            style={{ width: s.box * 0.86, height: s.box * 0.86 }}
            contentFit="contain"
          />
        ) : (
          <v.Icon size={s.icon} color={colors.primaryForeground} />
        )}
      </LinearGradient>

      {showText && (
        <View style={styles.textColumn}>
          <Text
            style={[
              styles.text,
              { fontSize: s.text, color: textColor },
            ]}
          >
            Pakwanhus
          </Text>
          <View style={styles.taglineRow}>
            <View style={[styles.taglineLine, { backgroundColor: colors.gradientSecondaryEnd }]} />
            <Text style={[styles.tagline, { color: colors.secondary }]}>HOME CHEFS</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flexDirection: "column",
    gap: 1,
  },
  text: {
    fontFamily: fonts.display,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taglineLine: {
    height: 1.5,
    width: 16,
    borderRadius: 1,
  },
  tagline: {
    fontFamily: fonts.sansBold,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
