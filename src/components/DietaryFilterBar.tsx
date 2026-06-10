import React from "react";
import { ScrollView, Pressable, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";

export const DIETARY_FILTERS = [
  { id: "vegan",      filterKey: "vegan",      label: "Vegan" },
  { id: "veg",        filterKey: "veg",        label: "Veg" },
  { id: "glutenFree", filterKey: "glutenFree", label: "Gluten-Free" },
  { id: "halal",      filterKey: "halal",      label: "Halal" },
  { id: "kosher",     filterKey: "kosher",     label: "Kosher" },
  { id: "nutFree",    filterKey: "nutFree",    label: "Nut-Free" },
  { id: "dairyFree",  filterKey: "dairyFree",  label: "Dairy-Free" },
  { id: "spicy",      filterKey: "spicy",      label: "Spicy" },
] as const;

interface Props {
  selectedFilters: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export const DietaryFilterBar = ({ selectedFilters, onToggle, onReset, hasActiveFilters }: Props) => (
  <View style={styles.wrapper}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      bounces={false}
    >
      {hasActiveFilters && (
        <Pressable onPress={onReset} style={styles.resetPill}>
          <Ionicons name="close-circle" size={13} color={colors.primary} />
          <Text style={styles.resetLabel}>Reset</Text>
        </Pressable>
      )}
      {DIETARY_FILTERS.map(f => {
        const active = selectedFilters.has(f.filterKey);
        return (
          <Pressable
            key={f.id}
            onPress={() => onToggle(f.filterKey)}
            style={[styles.pill, active && styles.pillActive]}
          >
            {active && (
              <Ionicons name="checkmark" size={12} color="#fff" style={styles.checkIcon} />
            )}
            <Text style={[styles.label, active && styles.labelActive]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkIcon: {
    marginRight: 4,
  },
  label: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
  },
  labelActive: {
    color: "#fff",
  },
  resetPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.lightSage,
    marginRight: spacing.sm,
  },
  resetLabel: {
    ...typography.sm,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: 4,
  },
});
