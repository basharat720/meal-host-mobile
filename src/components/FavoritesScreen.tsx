import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChefCard } from "@/components/ChefCard";
import { DishCard } from "@/components/DishCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useToast } from "@/components/ui/Toast";
import { favoriteService } from "@/services/favoriteService";
import { ChefListItem, FoodListing } from "@/services/types";
import { chefDisplayName } from "@/lib/chefName";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { getListingStartingPrice } from "@/lib/listingVariants";

type FavoritesTab = "chefs" | "dishes";

export default function FavoritesScreen() {
  const { user, dbUser, activeRole } = useAuth();
  const { chefIds, dishIds, refresh } = useFavorites();
  const { showToast } = useToast();

  const [tab, setTab] = useState<FavoritesTab>("chefs");
  const [chefs, setChefs] = useState<ChefListItem[]>([]);
  const [dishes, setDishes] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setFetchError(false);
    try {
      const [savedChefs, savedDishes] = await Promise.all([
        favoriteService.getChefs(),
        favoriteService.getDishes(),
      ]);
      setChefs(savedChefs ?? []);
      setDishes(savedDishes ?? []);
    } catch (e) {
      console.error("Failed to load favorites", e);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Reload on focus: a heart tapped on another screen should be reflected here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Unfavoriting from a card updates the shared ID sets; drop the card to match
  // rather than refetching the whole list for one removal.
  useEffect(() => {
    setChefs(prev => prev.filter(c => chefIds.includes(c.id)));
  }, [chefIds]);

  useEffect(() => {
    setDishes(prev => prev.filter(d => dishIds.includes(d.id)));
  }, [dishIds]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  };

  const confirmClearAll = () => {
    const isChefs = tab === "chefs";
    const count = isChefs ? chefs.length : dishes.length;
    if (count === 0) return;

    Alert.alert(
      isChefs
        ? `Remove all ${count} chefs from your favorites?`
        : `Remove all ${count} dishes from your favorites?`,
      `This can't be undone. Your favorite ${isChefs ? "dishes" : "chefs"} are left alone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            try {
              await favoriteService.clear(isChefs ? "chef" : "dish");
              if (isChefs) setChefs([]);
              else setDishes([]);
              await refresh();
              showToast({
                message: isChefs ? "Favorite kitchens cleared" : "Favorite dishes cleared",
                variant: "success",
              });
            } catch (e) {
              console.error("Failed to clear favorites", e);
              Alert.alert("Couldn't clear your favorites", "Please try again.");
            }
          },
        },
      ],
    );
  };

  const actingAsChef = activeRole ? activeRole === "chef" : dbUser?.is_chef === true;

  const header = (
    <View style={styles.header}>
      {router.canGoBack() && (
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
      )}
      <Text style={styles.headerTitle}>Favorites</Text>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <EmptyState
          icon="🤍"
          title="Sign in to save favorites"
          description="Your saved kitchens and dishes are kept with your account."
          actionLabel="Sign In"
          onAction={() =>
            router.push({
              pathname: "/(auth)/customer-login",
              params: { redirect: "/(tabs)/favorites" },
            })
          }
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return <FullScreenLoader message="Loading favorites…" />;
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <EmptyState
          icon="⚠️"
          title="Couldn't load your favorites"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            void load();
          }}
        />
      </SafeAreaView>
    );
  }

  const count = tab === "chefs" ? chefs.length : dishes.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}

      <View style={styles.tabRow}>
        <View style={styles.tabs}>
          {(["chefs", "dishes"] as FavoritesTab[]).map(value => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
                {value === "chefs" ? `Chefs (${chefs.length})` : `Dishes (${dishes.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {count > 0 && (
          <Pressable onPress={confirmClearAll} hitSlop={8} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={15} color={colors.destructive} />
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === "chefs" ? (
          chefs.length === 0 ? (
            <EmptyState
              icon="🤍"
              title="No favorite kitchens yet"
              description="Tap the heart on any kitchen to save it here."
              actionLabel={actingAsChef ? undefined : "Find kitchens"}
              onAction={actingAsChef ? undefined : () => router.push("/(tabs)/chefs")}
            />
          ) : (
            chefs.map(chef => {
              const tags = (chef.chef_profile?.dietary_tags ?? []).map(t => t.toUpperCase());
              return (
                <View key={chef.id} style={styles.chefCardWrap}>
                  <ChefCard
                    id={String(chef.id)}
                    name={chefDisplayName(chef)}
                    image={chef.chef_profile?.profile_picture_url ?? null}
                    specialties={chef.chef_profile?.specialties ?? []}
                    rating={chef.chef_profile?.rating_avg ?? 0}
                    reviews={chef.chef_profile?.review_count ?? 0}
                    isVeg={tags.includes("VEG") || tags.includes("VEGETARIAN")}
                    isOpenNow={chef.is_available !== false}
                    minPrice={chef.min_price ?? 0}
                    maxPrice={chef.max_price ?? 0}
                    onPress={() => router.push(`/chef/${chef.id}/menu`)}
                  />
                </View>
              );
            })
          )
        ) : dishes.length === 0 ? (
          <EmptyState
            icon="🤍"
            title="No favorite dishes yet"
            description="Tap the heart on any dish to save it here."
            actionLabel={actingAsChef ? undefined : "Browse dishes"}
            onAction={actingAsChef ? undefined : () => router.push("/(tabs)/home")}
          />
        ) : (
          <View style={styles.dishGrid}>
            {dishes.map(dish => (
              <DishCard
                key={dish.id}
                id={String(dish.id)}
                name={dish.title}
                description={dish.description}
                price={getListingStartingPrice(dish) ?? 0}
                image={
                  dish.images?.find(i => i.is_primary)?.image_url ||
                  dish.images?.[0]?.image_url ||
                  ""
                }
                chefId={String(dish.chef_id)}
                chefName={dish.chef_name || "Home Chef"}
                isVeg={dish.dietary_tags?.some(
                  t => t.code === "VEG" || t.code === "VEGETARIAN",
                )}
                cuisineTypes={dish.cuisine_types ?? []}
                rating={dish.chef_rating_avg ?? 0}
                hasVariants={dish.has_variants}
                preparationTimeMinutes={dish.preparation_time_minutes}
                isChefOffline={dish.chef_is_available === false}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backButton: { marginLeft: -4 },
  headerTitle: { ...typography.xl, fontWeight: "700", color: colors.foreground },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    padding: 3,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: colors.surface },
  tabText: { ...typography.sm, fontWeight: "600", color: colors.mutedForeground },
  tabTextActive: { color: colors.foreground },
  clearButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText: { ...typography.sm, fontWeight: "600", color: colors.destructive },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  chefCardWrap: { marginBottom: spacing.sm },
  dishGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
