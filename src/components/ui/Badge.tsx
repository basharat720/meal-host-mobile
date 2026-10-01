import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, typography } from "@/constants/theme";
import type { StatusTone } from "@/lib/orderStatus";

/**
 * `success` / `warning` / `destructive` are generic tones for anything that is
 * not an order — dish availability, request state. An order's status uses a
 * `StatusTone` instead, so it keeps the exact colour the website gives it.
 */
type Variant = "default" | "accent" | "success" | "warning" | "destructive" | "outline" | StatusTone;

export const Badge = ({ label, variant = "default" }: { label: string; variant?: Variant }) => (
  <View style={[styles.base, styles[variant]]}>
    <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
  </View>
);

// Status tones carry a border as well as a fill — the paler status fills need
// the edge to stay legible against a white card.
const tone = (t: StatusTone) => ({
  backgroundColor: colors.status[t].bg,
  borderWidth: 1,
  borderColor: colors.status[t].border,
});

const styles = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, alignSelf: "flex-start" },
  text: { ...typography.xs, fontWeight: "600" },

  default: { backgroundColor: colors.muted },
  // Solid orange uses secondaryStrong, not the raw brand orange: white text
  // on #FF3903 measures ~3.6:1, under the WCAG AA floor.
  accent: { backgroundColor: colors.secondaryStrong },
  success: { backgroundColor: colors.successSubtle },
  warning: { backgroundColor: colors.warningSubtle },
  destructive: { backgroundColor: colors.status.cancelled.bg },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },

  pending: tone("pending"),
  active: tone("active"),
  ready: tone("ready"),
  done: tone("done"),
  closed: tone("closed"),
  cancelled: tone("cancelled"),

  text_default: { color: colors.mutedForeground },
  text_accent: { color: colors.secondaryForeground },
  text_success: { color: colors.successSubtleForeground },
  text_warning: { color: colors.warningSubtleForeground },
  text_destructive: { color: colors.status.cancelled.fg },
  text_outline: { color: colors.foreground },

  text_pending: { color: colors.status.pending.fg },
  text_active: { color: colors.status.active.fg },
  text_ready: { color: colors.status.ready.fg },
  text_done: { color: colors.status.done.fg },
  text_closed: { color: colors.status.closed.fg },
  text_cancelled: { color: colors.status.cancelled.fg },
});
