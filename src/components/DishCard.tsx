import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/contexts/CartContext";
import { useI18n } from "@/i18n/context";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

interface DishCardProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  chefId: string;
  chefName: string;
  isVeg?: boolean;
  rating?: number;
  availableQty?: number;
  preparationTimeMinutes?: number;
}

export const DishCard = ({
  id, name, description, price, image, chefId, chefName,
  isVeg = false, rating, availableQty, preparationTimeMinutes,
}: DishCardProps) => {
  const { addItem } = useCart();
  const { formatPrice } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 2 - spacing.sm) / 2;

  const handleAddToCart = () => {
    const result = addItem({ id, name, price, image, chefId, chefName }, availableQty);
    if (!result.success) {
      if (result.requiresSwitch && result.pendingItem) {
        Alert.alert("Switch Chef?", result.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Switch", style: "destructive", onPress: () => addItem(result.pendingItem!) },
        ]);
      } else if (result.message) {
        Alert.alert("Can't Add", result.message);
      }
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/chef/${chefId}`)}
      style={[styles.card, { width: cardWidth }]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        {isVeg && (
          <View style={styles.vegBadge}>
            <Text style={styles.vegText}>🌿 Veg</Text>
          </View>
        )}
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); handleAddToCart(); }}
          style={styles.addButton}
          hitSlop={8}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {description ? <Text style={styles.description} numberOfLines={1}>{description}</Text> : null}
        <Text style={styles.chefName} numberOfLines={1}>{chefName}</Text>

        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(price)}</Text>
          <View style={styles.meta}>
            {!!rating && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={11} color={colors.warning} />
                <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {!!preparationTimeMinutes && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{preparationTimeMinutes}m</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  imageContainer: { position: "relative", aspectRatio: 4 / 3, backgroundColor: colors.muted },
  image: { width: "100%", height: "100%" },
  vegBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2,
  },
  vegText: { fontSize: 10, fontWeight: "600", color: "#166534" },
  addButton: {
    position: "absolute", bottom: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadow.md,
  },
  content: { padding: spacing.sm },
  name: { ...typography.sm, fontWeight: "700", color: colors.foreground },
  description: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  chefName: { ...typography.xs, color: colors.mutedForeground, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  price: { ...typography.sm, fontWeight: "800", color: colors.foreground },
  meta: { flexDirection: "row", gap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  metaText: { ...typography.xs, color: colors.mutedForeground },
});
