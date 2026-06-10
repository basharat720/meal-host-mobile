import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart, CartItem } from "@/contexts/CartContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, spacing, radius, typography, shadow } from "@/constants/theme";

export default function CartScreen() {
  const { items, updateQuantity, removeItem, total } = useCart();
  const router = useRouter();

  const handleRemove = (item: CartItem) => {
    Alert.alert("Remove Item", `Remove "${item.name}" from cart?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeItem(item.id) },
    ]);
  };

  const formatPrice = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <EmptyState
          icon="🛍️"
          title="Your cart is empty"
          description="Looks like you haven't added any delicious food yet. Explore our chefs and find something you love!"
          actionLabel="Browse Chefs"
          onAction={() => router.push("/(tabs)/chefs")}
        />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.image }}
        style={styles.itemImage}
        contentFit="cover"
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.chefName}>{item.chefName}</Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.qtyRow}>
          <Pressable
            style={styles.qtyButton}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            hitSlop={8}
          >
            <Ionicons name="remove" size={16} color={colors.primary} />
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable
            style={styles.qtyButton}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            hitSlop={8}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.rightColumn}>
        <Pressable onPress={() => handleRemove(item)} hitSlop={8} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </Pressable>
        <Text style={styles.lineTotal}>
          {formatPrice(item.price * item.quantity)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        <Text style={styles.headerSubtitle}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryItem} numberOfLines={1}>
                  {item.name} × {item.quantity}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>

            <Button
              variant="primary"
              size="lg"
              style={styles.checkoutButton}
              onPress={() => router.push("/(tabs)/checkout")}
            >
              Proceed to Checkout
            </Button>

            <Text style={styles.terms}>
              By placing your order, you agree to our Terms of Service
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.md,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  chefName: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  itemPrice: {
    ...typography.base,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    ...typography.base,
    fontWeight: "700",
    color: colors.foreground,
    minWidth: 20,
    textAlign: "center",
  },
  rightColumn: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 80,
  },
  removeBtn: {
    padding: 4,
  },
  lineTotal: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.foreground,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.md,
  },
  summaryTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  summaryItem: {
    ...typography.sm,
    color: colors.mutedForeground,
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryItemPrice: {
    ...typography.sm,
    color: colors.foreground,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  totalLabel: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.foreground,
  },
  totalValue: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.primary,
  },
  checkoutButton: {
    width: "100%",
  },
  terms: {
    ...typography.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
