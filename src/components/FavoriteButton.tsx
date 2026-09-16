import React from "react";
import { Pressable, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFavorites } from "@/contexts/FavoritesContext";
import { FavoriteType } from "@/services/favoriteService";
import { colors, radius, shadow } from "@/constants/theme";

interface FavoriteButtonProps {
  type: FavoriteType;
  id: number | string;
  /** What the heart is on, for the screen-reader label: "Save Karachi Kitchen". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The heart that saves a chef or a dish.
 *
 * Sits on top of a card that is itself pressable, so it stops the press from
 * reaching the card underneath. There is no hovering on a phone, so unlike the
 * website's heart this one is always visible.
 */
export const FavoriteButton = ({ type, id, label, style }: FavoriteButtonProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(type, id);
  const describe = label ? ` ${label}` : "";

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        toggleFavorite(type, id);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={
        saved ? `Remove${describe} from favorites` : `Save${describe} to favorites`
      }
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Ionicons
        name={saved ? "heart" : "heart-outline"}
        size={17}
        color={saved ? colors.destructive : colors.foreground}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.92 }] },
});

export default FavoriteButton;
