import React from "react";
import { StyleProp, ImageStyle } from "react-native";
import { Image } from "expo-image";

/**
 * Pal the Ghost — the FoodPal mascot. Mirrors meal-host-frontend's
 * `src/components/Mascot.tsx`: the same six poses, from the same artwork.
 *
 * Pal belongs on order-status strips, empty states, onboarding and error
 * screens. Pal is decorative: hidden from screen readers, so the copy beside
 * it has to stand on its own.
 */
export type MascotPose =
  | "idle"
  | "cooking"
  | "flying"
  | "delivering"
  | "celebrating"
  | "love";

const POSES: Record<MascotPose, { source: number; aspect: number }> = {
  idle: { source: require("../../assets/mascot/pal-idle.webp"), aspect: 370 / 560 },
  cooking: { source: require("../../assets/mascot/pal-cooking.webp"), aspect: 434 / 509 },
  flying: { source: require("../../assets/mascot/pal-flying.webp"), aspect: 560 / 305 },
  delivering: { source: require("../../assets/mascot/pal-delivering.webp"), aspect: 560 / 509 },
  celebrating: { source: require("../../assets/mascot/pal-celebrating.webp"), aspect: 547 / 560 },
  love: { source: require("../../assets/mascot/pal-love.webp"), aspect: 513 / 555 },
};

// Heights match the web's h-20 / h-32 / h-44 / h-60.
const SIZES = { sm: 80, md: 128, lg: 176, xl: 240 } as const;

export interface MascotProps {
  pose?: MascotPose;
  size?: keyof typeof SIZES;
  /** Explicit height in points; overrides `size`. */
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function Mascot({ pose = "idle", size = "md", height, style }: MascotProps) {
  const { source, aspect } = POSES[pose];
  const h = height ?? SIZES[size];
  return (
    <Image
      source={source}
      style={[{ height: h, width: h * aspect }, style]}
      contentFit="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export default Mascot;
