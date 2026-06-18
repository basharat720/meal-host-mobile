import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { DishCard } from "@/components/DishCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { dishService, cuisineService } from "@/services/api";
import { CuisineType } from "@/services/types";
import { useI18n } from "@/i18n/context";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { Logo } from "@/components/Logo";
import { router } from "expo-router";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "topRated",  label: "Top Rated" },
  { value: "priceLow",  label: "Price: Low to High" },
  { value: "priceHigh", label: "Price: High to Low" },
];

const PAGE_SIZE = 12;

export default function HomeScreen() {
  const { formatPrice } = useI18n();
  const [allDishes, setAllDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // API-driven cuisine types
  const [cuisineTypes, setCuisineTypes] = useState<CuisineType[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Pagination
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchDishes = useCallback(async (lat?: number, lon?: number) => {
    try {
      setIsLoading(true);
      setFetchError(false);
      const params: any = { limit: 100 };
      if (lat && lon) { params.lat = lat; params.lon = lon; params.radius_km = 50; }
      else { params.query = ""; }
      const raw = await dishService.searchFood(params);
      const mapped = raw.map((d: any) => ({
        id: d.id.toString(),
        name: d.title,
        chef: d.chef_name || "Home Chef",
        chefId: d.chef_id?.toString() ?? "",
        image: d.images?.find((i: any) => i.is_primary)?.image_url || d.images?.[0]?.image_url || "",
        price: d.price,
        rating: d.chef_rating_avg ?? 0,
        reviews: d.chef_review_count ?? 0,
        isVegan:     d.dietary_tags?.some((t: any) => t.code === "VEGAN") || false,
        isVeg:       d.dietary_tags?.some((t: any) => t.code === "VEG" || t.code === "VEGETARIAN") || false,
        isGlutenFree:d.dietary_tags?.some((t: any) => t.code === "GF" || t.code === "GLUTEN_FREE") || false,
        isHalal:     d.dietary_tags?.some((t: any) => t.code === "HALAL") || false,
        isKosher:    d.dietary_tags?.some((t: any) => t.code === "KOSHER") || false,
        isNutFree:   d.dietary_tags?.some((t: any) => t.code === "NUT_FREE") || false,
        isDairyFree: d.dietary_tags?.some((t: any) => t.code === "DAIRY_FREE") || false,
        isSpicy:     d.dietary_tags?.some((t: any) => t.code === "SPICY") || false,
        description: d.description || "",
        cuisineTypes: d.cuisine_types || [],
        preparationTimeMinutes: d.preparation_time_minutes,
        availableQty: d.available_quantity,
        chefIsAvailable: d.chef_is_available !== false,
      }));
      setAllDishes(mapped);
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          fetchDishes(loc.coords.latitude, loc.coords.longitude);
        } catch {
          fetchDishes();
        }
      } else {
        fetchDishes();
      }
    })();
  }, [fetchDishes]);

  useEffect(() => {
    cuisineService.getCuisineTypes()
      .then(setCuisineTypes)
      .catch(() => {});
  }, []);

  // Reset pagination when filters change
  useEffect(() => { setDisplayedCount(PAGE_SIZE); }, [searchQuery, sortBy, selectedCuisines]);

  const filteredDishes = allDishes.filter((d) => {
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase()) && !d.chef.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCuisines.size > 0) {
      const hasCuisine = d.cuisineTypes?.some((ct: any) => selectedCuisines.has(ct.code));
      if (!hasCuisine) return false;
    }
    return true;
  });

  // Offline chefs always sort last, matching the web behaviour
  const sortedDishes = [...filteredDishes].sort((a, b) => {
    if (a.chefIsAvailable !== b.chefIsAvailable) return a.chefIsAvailable ? -1 : 1;
    if (sortBy === "topRated") return b.rating - a.rating;
    if (sortBy === "priceLow") return a.price - b.price;
    if (sortBy === "priceHigh") return b.price - a.price;
    return 0;
  });

  const displayedDishes = sortedDishes.slice(0, displayedCount);
  const hasMore = displayedCount < sortedDishes.length;

  const hasActiveFilters = searchQuery !== "" || selectedCuisines.size > 0 || sortBy !== "relevance";

  const resetFilters = () => {
    setSearchQuery("");
    setSortBy("relevance");
    setSelectedCuisines(new Set());
  };

  const toggleCuisine = (code: string) => {
    setSelectedCuisines((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleEndReached = () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + PAGE_SIZE, sortedDishes.length));
      setIsLoadingMore(false);
    }, 400);
  };

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    if (index % 2 === 1) return null;
    const next = displayedDishes[index + 1];
    return (
      <View style={styles.row}>
        <DishCard
          id={item.id} name={item.name} description={item.description}
          price={item.price} image={item.image} chefId={item.chefId}
          chefName={item.chef} isVeg={item.isVeg} rating={item.rating}
          availableQty={item.availableQty} preparationTimeMinutes={item.preparationTimeMinutes}
          isChefOffline={!item.chefIsAvailable}
        />
        {next ? (
          <DishCard
            id={next.id} name={next.name} description={next.description}
            price={next.price} image={next.image} chefId={next.chefId}
            chefName={next.chef} isVeg={next.isVeg} rating={next.rating}
            availableQty={next.availableQty} preparationTimeMinutes={next.preparationTimeMinutes}
            isChefOffline={!next.chefIsAvailable}
          />
        ) : <View style={{ flex: 1 }} />}
      </View>
    );
  }, [displayedDishes]);

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="🍽️" title="Couldn't load dishes" description="The kitchen seems busy. Please check your connection and try again." actionLabel="Retry" onAction={() => fetchDishes()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top bar with logo */}
      <View style={styles.topBar}>
        <Logo size="md" showText={true} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color={colors.mutedForeground} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes or chefs..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={20} color={hasActiveFilters ? colors.primary : colors.foreground} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </Pressable>
        </View>
      </View>

      {/* Cuisine type chips from API */}
      {cuisineTypes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineChipsRow}
          style={styles.cuisineChipsContainer}
        >
          {cuisineTypes.map((cuisine) => (
            <Pressable
              key={cuisine.code}
              style={[styles.cuisineChip, selectedCuisines.has(cuisine.code) && styles.cuisineChipActive]}
              onPress={() => toggleCuisine(cuisine.code)}
            >
              <Text style={[styles.cuisineChipText, selectedCuisines.has(cuisine.code) && styles.cuisineChipTextActive]}>
                {cuisine.name}
              </Text>
            </Pressable>
          ))}
          {selectedCuisines.size > 0 && (
            <Pressable
              style={styles.cuisineChipReset}
              onPress={() => setSelectedCuisines(new Set())}
            >
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
              <Text style={styles.cuisineChipResetText}>Reset</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Request a dish banner */}
      <Pressable
        style={({ pressed }) => [styles.requestBanner, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/(tabs)/post-request")}
      >
        <View style={styles.requestBannerLeft}>
          <Ionicons name="bulb-outline" size={20} color={colors.accent} />
          <View>
            <Text style={styles.requestBannerTitle}>Can't find what you're craving?</Text>
            <Text style={styles.requestBannerSub}>Post a custom dish request — chefs will offer!</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.accent} />
      </Pressable>

      {/* Results header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Popular Near You</Text>
        <Text style={styles.resultsCount}>{sortedDishes.length} dishes</Text>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Finding dishes near you...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedDishes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState icon="🔍" title="No dishes found" description="Try adjusting your search or filters." actionLabel="Clear Filters" onAction={resetFilters} />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Loading more...</Text>
              </View>
            ) : !hasMore && displayedDishes.length > 0 ? (
              <Text style={styles.endText}>You've seen all {sortedDishes.length} dishes</Text>
            ) : null
          }
        />
      )}

      {/* Advanced Filter Modal */}
      <Modal visible={filterModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters & Sort</Text>
            <Pressable onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Sort */}
            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
                  onPress={() => setSortBy(opt.value)}
                >
                  <Text style={[styles.sortOptionText, sortBy === opt.value && styles.sortOptionTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Cuisines from API */}
            {cuisineTypes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Cuisines</Text>
                <View style={styles.cuisineGrid}>
                  {cuisineTypes.map((c) => (
                    <Pressable
                      key={c.code}
                      style={[styles.modalCuisineChip, selectedCuisines.has(c.code) && styles.modalCuisineChipActive]}
                      onPress={() => toggleCuisine(c.code)}
                    >
                      <Text style={[styles.modalCuisineText, selectedCuisines.has(c.code) && styles.modalCuisineTextActive]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={() => { resetFilters(); setFilterModalVisible(false); }} style={styles.modalBtn}>Reset</Button>
            <Button onPress={() => setFilterModalVisible(false)} style={styles.modalBtn}>Apply</Button>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, ...typography.base, color: colors.foreground },
  filterButton: {
    width: 44, height: 44, borderRadius: radius.xl,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  filterDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary,
  },

  // Cuisine chips horizontal scroll
  cuisineChipsContainer: { maxHeight: 48 },
  cuisineChipsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    alignItems: "center",
  },
  cuisineChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cuisineChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  cuisineChipText: { ...typography.sm, fontFamily: fonts.sansMedium, color: colors.mutedForeground },
  cuisineChipTextActive: { color: "#fff", fontFamily: fonts.sansSemiBold },
  cuisineChipReset: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  cuisineChipResetText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },

  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: `${colors.accent}18`,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent}40`,
  },
  requestBannerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  requestBannerTitle: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.foreground },
  requestBannerSub: { ...typography.xs, fontFamily: fonts.sans, color: colors.mutedForeground },

  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  resultsTitle: { ...typography.lg, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground },
  resultsCount: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing["2xl"] },
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  loaderContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loaderText: { ...typography.sm, color: colors.mutedForeground },
  loadMore: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  endText: { textAlign: "center", ...typography.sm, color: colors.mutedForeground, paddingVertical: spacing.lg },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.xl, fontFamily: fonts.display, fontWeight: "700", color: colors.foreground },
  modalContent: { padding: spacing.md },
  sectionTitle: { ...typography.md, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.foreground, marginTop: spacing.lg, marginBottom: spacing.sm },
  sortOptions: { gap: spacing.sm },
  sortOption: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  sortOptionActive: { borderColor: colors.primary, backgroundColor: colors.lightSage },
  sortOptionText: { ...typography.base, fontFamily: fonts.sans, color: colors.foreground },
  sortOptionTextActive: { color: colors.primary, fontFamily: fonts.sansBold, fontWeight: "700" },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap" },
  modalCuisineChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginRight: spacing.sm, marginBottom: spacing.sm },
  modalCuisineChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  modalCuisineText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  modalCuisineTextActive: { color: "#fff", fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  modalFooter: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  modalBtn: { flex: 1 },
});
