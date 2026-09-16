import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/integrations/firebase/auth";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

const ROLE_META: Record<
  UserRole,
  { label: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  chef: {
    label: "Chef Mode",
    description: "Manage menu, orders, availability",
    icon: "restaurant-outline",
  },
  customer: {
    label: "Customer Mode",
    description: "Browse chefs, place orders",
    icon: "person-outline",
  },
};

/**
 * Lets an account that holds both roles choose which one it is acting as.
 *
 * Renders nothing for the single-role accounts that make up almost everyone —
 * there is no choice to offer them.
 */
export const RoleSwitcher = () => {
  const { activeRole, availableRoles, switchRole } = useAuth();

  if (availableRoles.length <= 1) return null;

  const handleSwitch = (role: UserRole) => {
    if (role === activeRole) return;
    switchRole(role);
    // The route guards would bounce us anyway once activeRole changes; going
    // there directly avoids a visible flash of the wrong area.
    router.replace(role === "chef" ? "/(chef)/dashboard" : "/(tabs)/chefs");
    Alert.alert(
      role === "chef" ? "Switched to Chef Mode" : "Switched to Customer Mode"
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Mode</Text>
      <View style={styles.card}>
        {availableRoles.map((role, index) => {
          const meta = ROLE_META[role];
          const selected = role === activeRole;
          return (
            <Pressable
              key={role}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivided,
                pressed && styles.rowPressed,
              ]}
              onPress={() => handleSwitch(role)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={meta.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{meta.label}</Text>
                <Text style={styles.rowDescription}>{meta.description}</Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.muted },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.lightSage,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  rowDescription: { ...typography.xs, color: colors.mutedForeground },
});
