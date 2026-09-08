/**
 * Brand marks ported from lucide (v0.462.0, ISC) so mobile renders the exact same
 * artwork the web app does via lucide-react. Path data and the stroke defaults
 * (24x24 viewBox, strokeWidth 2, round caps/joins, no fill) are copied verbatim —
 * keep them in sync with meal-host-frontend's lucide-react if that is upgraded.
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  /** Lucide strokes at 2 on a 24px grid; scale it up for very small renders. */
  strokeWidth?: number;
}

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
};

const STROKE = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** lucide `utensils-crossed` — the customer mark. */
export function UtensilsCrossedIcon({
  size = 24,
  color = "#FFFFFF",
  strokeWidth = STROKE.strokeWidth,
}: IconProps) {
  return (
    <Svg width={size} height={size} {...BASE}>
      <Path
        d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
      <Path
        d="m2.1 21.8 6.4-6.3"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
      <Path
        d="m19 5-7 7"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

/** lucide `chef-hat` — the chef mark. */
export function ChefHatIcon({
  size = 24,
  color = "#FFFFFF",
  strokeWidth = STROKE.strokeWidth,
}: IconProps) {
  return (
    <Svg width={size} height={size} {...BASE}>
      <Path
        d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M6 17h12"
        stroke={color}
        {...STROKE}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
