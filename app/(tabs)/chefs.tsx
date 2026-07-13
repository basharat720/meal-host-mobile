import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChefCard } from "@/components/ChefCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { chefService } from "@/services/api";
import { Chef } from "@/services/types";
import { colors, fonts, radius, spacing, typography, shadow } from "@/constants/theme";
import { Logo } from "@/components/Logo";

interface MappedChef {
  id: string;
  name: string;
  image: string | null;
  specialties: string[];
  rating: number;
  reviews: number;
  isVerified: boolean;
  isVeg: boolean;
  minPrice: number;
  maxPrice: number;
}

function mapChef(chef: Chef): MappedChef {
  const tags = chef.dietary_tags ?? [];
  return {
    id: String(chef.id),
    name: chef.name,
    image: chef.chef_profile?.profile_picture_url ?? null,
    specialties: chef.chef_profile?.specialties ?? chef.specialties ?? [],
    rating: chef.chef_profile?.rating_avg ?? 0,
    reviews: chef.chef_profile?.review_count ?? 0,
    isVerified:
      chef.status === "VERIFIED" || chef.chef_profile?.status === "active",
    isVeg: tags.some(
      (t) => t.toUpperCase() === "VEG" || t.toUpperCase() === "VEGETARIAN"
    ),
    minPrice: chef.minPrice ?? 0,
    maxPrice: chef.maxPrice ?? 0,
  };
}

export default function ChefsScreen() {
  const { width } = useWindowDimensions();
  const [allChefs, setAllChefs] = useState<MappedChef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const hasLoadedRef = useRef(false);

  const fetchChefs = useCallback(async (silent = false) => {
    try {
      // Keep the existing list visible on refocus/pull-to-refresh instead of
      // flashing the full-screen loader.
      if (!silent) setIsLoading(true);
      setFetchError(false);
      const data = await chefService.getAllChefs();
      setAllChefs(data.map(mapChef));
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refetch whenever the screen regains focus so chefs never show stale data.
  useFocusEffect(
    useCallback(() => {
      fetchChefs(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchChefs])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchChefs(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchChefs]);

  const filteredChefs = allChefs.filter((chef) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      chef.name.toLowerCase().includes(q) ||
      chef.specialties.some((s) => s.toLowerCase().includes(q))
    );
  });

  // Column width: 2 columns with gap
  const COLUMN_GAP = spacing.sm;
  const H_PADDING = spacing.md;
  const columnWidth = (width - H_PADDING * 2 - COLUMN_GAP) / 2;

  const renderItem = useCallback(
    ({ item }: { item: MappedChef }) => (
      <View style={{ width: columnWidth }}>
        <ChefCard
          {...item}
          onPress={() => router.push(`/chef/${item.id}`)}
        />
      </View>
    ),
    [columnWidth]
  );

  if (isLoading) {
    return <FullScreenLoader message="Finding home chefs..." />;
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <EmptyState
          icon="👨‍🍳"
          title="Couldn't load chefs"
          description="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => fetchChefs()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Logo size="md" showText={true} />
        <Text style={styles.headerTitle}>Home Chefs</Text>
        <Text style={styles.headerSubtitle}>
          Discover authentic home-cooked meals near you
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.mutedForeground}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chefs or cuisines..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Count */}
      {filteredChefs.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filteredChefs.length} chef{filteredChefs.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      <FlatList
        data={filteredChefs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="No chefs found"
            description="Try adjusting your search."
            actionLabel="Clear Search"
            onAction={() => setSearchQuery("")}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  headerTitle: {
    ...typography["2xl"],
    fontFamily: fonts.display,
    fontWeight: "700",
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.sm,
    fontFamily: fonts.sans,
    color: colors.mutedForeground,
  },

  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    ...typography.base,
    color: colors.foreground,
  },

  countRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  countText: {
    ...typography.sm,
    color: colors.mutedForeground,
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing["2xl"],
    paddingTop: spacing.sm,
  },
  columnWrapper: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
