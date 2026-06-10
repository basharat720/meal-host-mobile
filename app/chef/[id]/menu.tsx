import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { DishCard } from "@/components/DishCard";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { chefService, menuService } from "@/services/api";
import { Chef, FoodListing } from "@/services/types";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";

interface MappedChef {
  id: string;
  name: string;
  image: string | null;
  cuisine: string;
  rating: number;
  location: string;
  bio: string;
  isVerified: boolean;
  isVeg: boolean;
}

function mapChefForDisplay(chef: Chef, listings: FoodListing[]): MappedChef {
  const profile = chef.chef_profile;
  return {
    id: chef.firebase_uid,
    name: chef.name,
    image: profile?.profile_picture_url ?? null,
    cuisine: profile?.specialties?.join(", ") || "Diverse",
    rating: profile?.rating_avg ?? 0,
    location:
      chef.locations?.find((l) => l.is_primary)?.address ?? "Local Kitchen",
    bio:
      profile?.kitchen_description ??
      "Passionate home cook sharing authentic family recipes.",
    isVerified:
      chef.status === "VERIFIED" || profile?.status === "active",
    isVeg:
      (profile?.dietary_tags ?? []).some(
        (t) => t.toUpperCase() === "VEG" || t.toUpperCase() === "VEGETARIAN"
      ) ||
      listings.some((l) =>
        l.dietary_tags?.some(
          (t) => t.code === "VEG" || t.code === "VEGETARIAN"
        )
      ),
  };
}

export default function ChefMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();

  const [chef, setChef] = useState<MappedChef | null>(null);
  const [menuItems, setMenuItems] = useState<FoodListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const [chefData, listings] = await Promise.all([
        chefService.getChef(id),
        menuService.getChefListingsPublic(id),
      ]);
      const activeListings = listings.filter((l) => l.status === "ACTIVE");
      setChef(mapChefForDisplay(chefData, activeListings));
      setMenuItems(activeListings);
    } catch {
      setFetchError("We couldn't load this chef's menu right now.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Column width calculation: 2 columns with gap and horizontal padding
  const COLUMN_GAP = spacing.sm;
  const H_PADDING = spacing.md;
  const columnWidth = (width - H_PADDING * 2 - COLUMN_GAP) / 2;

  const renderItem = useCallback(
    ({ item, index }: { item: FoodListing; index: number }) => {
      if (index % 2 === 1) return null; // pairs rendered together
      const next = menuItems[index + 1];
      const primaryImage = (l: FoodListing) =>
        l.images?.find((i) => i.is_primary)?.image_url ??
        l.images?.[0]?.image_url ??
        "";
      const isVeg = (l: FoodListing) =>
        l.dietary_tags?.some(
          (t) => t.code === "VEG" || t.code === "VEGETARIAN"
        ) ?? false;

      return (
        <View style={styles.row}>
          <DishCard
            id={item.id.toString()}
            name={item.title}
            description={item.description}
            price={item.price}
            image={primaryImage(item)}
            chefId={id ?? ""}
            chefName={chef?.name ?? ""}
            isVeg={isVeg(item)}
            rating={chef?.rating}
            availableQty={item.available_quantity}
            preparationTimeMinutes={item.preparation_time_minutes}
          />
          {next ? (
            <DishCard
              id={next.id.toString()}
              name={next.title}
              description={next.description}
              price={next.price}
              image={primaryImage(next)}
              chefId={id ?? ""}
              chefName={chef?.name ?? ""}
              isVeg={isVeg(next)}
              rating={chef?.rating}
              availableQty={next.available_quantity}
              preparationTimeMinutes={next.preparation_time_minutes}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      );
    },
    [menuItems, chef, id]
  );

  if (isLoading) {
    return <FullScreenLoader message="Loading menu..." />;
  }

  if (fetchError || !chef) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.destructive}
          />
          <Text style={styles.errorTitle}>
            {fetchError ?? "Chef not found"}
          </Text>
          <View style={styles.errorActions}>
            <Button
              variant="outline"
              onPress={() => router.push("/(tabs)/chefs")}
              style={styles.errorBtn}
            >
              Browse Chefs
            </Button>
            <Button onPress={loadData} style={styles.errorBtn}>
              Retry
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const initials = chef.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ListHeader = (
    <>
      {/* Back nav */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>

      {/* Chef header */}
      <View style={styles.chefHeader}>
        <View style={styles.chefAvatarWrap}>
          {chef.image ? (
            <Image
              source={{ uri: chef.image }}
              style={styles.chefAvatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.chefAvatar, styles.chefAvatarFallback]}>
              <Text style={styles.chefAvatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={styles.chefInfo}>
          <View style={styles.chefNameRow}>
            <Text style={styles.chefName}>{chef.name}</Text>
            {chef.isVerified && (
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={colors.success}
              />
            )}
            {chef.isVeg && (
              <View style={styles.vegBadge}>
                <Text style={styles.vegText}>🌿 Veg</Text>
              </View>
            )}
          </View>

          <Text style={styles.chefCuisine}>{chef.cuisine}</Text>

          <View style={styles.chefMeta}>
            {chef.rating > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.metaText}>{chef.rating.toFixed(1)}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons
                name="location-outline"
                size={13}
                color={colors.mutedForeground}
              />
              <Text style={styles.metaText} numberOfLines={1}>
                {chef.location}
              </Text>
            </View>
          </View>

          {!!chef.bio && (
            <Text style={styles.chefBio} numberOfLines={2}>
              {chef.bio}
            </Text>
          )}
        </View>
      </View>

      {/* Section heading */}
      <View style={styles.menuHeading}>
        <Text style={styles.menuTitle}>Today's Menu</Text>
        {menuItems.length > 0 && (
          <Text style={styles.menuCount}>{menuItems.length} items</Text>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="🍽️"
            title="No menu items yet"
            description="This chef hasn't added any menu items yet."
            actionLabel="Back to Chefs"
            onAction={() => router.push("/(tabs)/chefs")}
          />
        }
        ListFooterComponent={
          menuItems.length > 0 ? (
            <Text style={styles.endText}>
              You've seen all {menuItems.length} items
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backLabel: {
    ...typography.sm,
    color: colors.mutedForeground,
  },

  // Chef header
  chefHeader: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.secondary,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  chefAvatarWrap: {
    ...shadow.md,
    borderRadius: radius.xl,
  },
  chefAvatar: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chefAvatarFallback: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chefAvatarInitials: {
    ...typography["2xl"],
    fontWeight: "700",
    color: colors.primary,
  },
  chefInfo: { flex: 1 },
  chefNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  chefName: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  vegBadge: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vegText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#166534",
  },
  chefCuisine: {
    ...typography.sm,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 6,
  },
  chefMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    ...typography.sm,
    color: colors.mutedForeground,
  },
  chefBio: {
    ...typography.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },

  // Menu section
  menuHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  menuTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  menuCount: {
    ...typography.sm,
    color: colors.mutedForeground,
  },

  listContent: {
    paddingBottom: spacing["2xl"],
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  endText: {
    textAlign: "center",
    ...typography.sm,
    color: colors.mutedForeground,
    paddingVertical: spacing.lg,
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.lg,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  errorBtn: { flex: 1 },
});
