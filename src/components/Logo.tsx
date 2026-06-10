import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, radius } from "@/constants/theme";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  dark?: boolean;
}

const SIZES = {
  sm: { box: 32, icon: 18, text: 18 },
  md: { box: 40, icon: 22, text: 22 },
  lg: { box: 52, icon: 28, text: 28 },
};

export function Logo({ size = "md", showText = true, dark = false }: LogoProps) {
  const s = SIZES[size];
  const textColor = dark ? colors.dark.foreground : colors.foreground;

  return (
    <View style={styles.row}>
      <LinearGradient
        colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
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
        <MaterialCommunityIcons
          name="chef-hat"
          size={s.icon}
          color={colors.primaryForeground}
        />
      </LinearGradient>

      {showText && (
        <Text
          style={[
            styles.text,
            { fontSize: s.text, color: textColor },
          ]}
        >
          MealHost
        </Text>
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
  text: {
    fontFamily: fonts.display,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
