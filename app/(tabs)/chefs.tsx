import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Switch,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { ChefCard } from "@/components/ChefCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullScreenLoader } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { chefService, cuisineService } from "@/services/api";
import {
  ChefListItem,
  ChefSearchParams,
  CuisineType,
  MatchedDish,
} from "@/services/types";
import { useAuth } from "@/contexts/AuthContext";
import { chefDisplayName } from "@/lib/chefName";
import { colors, fonts, radius, spacing, typography, shadow } from "@/constants/theme";
import { Logo } from "@/components/Logo";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "topRated", label: "Top rated" },
  { value: "priceLow", label: "Price: low to high" },
  { value: "priceHigh", label: "Price: high to low" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5];

const PAGE_SIZE = 24;

interface MappedChef {
  id: string;
  name: string;
  image: string | null;
  specialties: string[];
  rating: number;
  reviews: number;
  isVeg: boolean;
  isOpenNow: boolean;
  minPrice: number;
  maxPrice: number;
  matchedDishes: MatchedDish[];
  distanceKm: number | null;
}

function mapChef(chef: ChefListItem): MappedChef {
  const tags = (chef.chef_profile?.dietary_tags ?? []).map((t) => t.toUpperCase());
  return {
    id: String(chef.id),
    name: chefDisplayName(chef),
    image: chef.chef_profile?.profile_picture_url ?? null,
    specialties: chef.chef_profile?.specialties ?? [],
    rating: chef.chef_profile?.rating_avg ?? 0,
    reviews: chef.chef_profile?.review_count ?? 0,
    isVeg: tags.includes("VEG") || tags.includes("VEGETARIAN"),
    isOpenNow: chef.is_available !== false,
    minPrice: chef.min_price ?? 0,
    maxPrice: chef.max_price ?? 0,
    matchedDishes: chef.matched_dishes ?? [],
    distanceKm: chef.distance_km ?? null,
  };
}

export default function ChefsScreen() {
  const { width } = useWindowDimensions();
  const { dbUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortValue>("relevance");
  const [minRating, setMinRating] = useState(0);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cuisineTypes, setCuisineTypes] = useState<CuisineType[]>([]);

  // Results
  const [chefs, setChefs] = useState<MappedChef[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Customer coordinates, resolved once. `null` means "asked and unavailable".
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [coordsResolved, setCoordsResolved] = useState(false);

  // Guards against a slow earlier request overwriting a newer result set.
  const requestIdRef = useRef(0);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Resolve the position once, so the backend can lead with the nearest chefs
  // and each card can show its distance. Only read it when permission has
  // already been granted — the tab shouldn't open with a system prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        }
      } catch {
        // Distance is an enhancement; searching without it is fine.
      } finally {
        if (!cancelled) setCoordsResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    cuisineService
      .getCuisineTypes()
      .then(setCuisineTypes)
      .catch(() => setCuisineTypes([]));
  }, []);

  const searchParams: ChefSearchParams = useMemo(() => {
    const params: ChefSearchParams = { sort: sortBy, limit: PAGE_SIZE };
    if (debouncedSearch) params.query = debouncedSearch;
    if (selectedCuisines.size > 0) params.cuisine_type_codes = [...selectedCuisines];
    if (minRating > 0) params.min_rating = minRating;
    if (openNowOnly) params.available_only = true;
    if (coords) {
      params.lat = coords.lat;
      params.lon = coords.lon;
    }
    return params;
  }, [debouncedSearch, selectedCuisines, sortBy, minRating, openNowOnly, coords]);

  const runSearch = useCallback(
    async (nextPage: number, { append, silent }: { append: boolean; silent?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (append) setIsLoadingMore(true);
      else {
        if (!silent) setIsLoading(true);
        setFetchError(false);
      }

      try {
        const result = await chefService.searchChefs({
          ...searchParams,
          skip: nextPage * PAGE_SIZE,
        });
        // A newer search has already been issued; discard this response.
        if (requestId !== requestIdRef.current) return;
        const mapped = result.chefs.map(mapChef);
        setChefs((prev) => (append ? [...prev, ...mapped] : mapped));
        setTotal(result.total);
        setPage(nextPage);
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (!append) setFetchError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [searchParams]
  );

  // Re-run whenever the query or any filter changes. Waiting for the location
  // lookup to settle avoids an immediate second request with coordinates.
  useEffect(() => {
    if (!coordsResolved) return;
    runSearch(0, { append: false });
  }, [coordsResolved, runSearch]);

  // Refresh on refocus so availability and prices are never stale, but keep
  // the current list on screen while it reloads.
  const hasLoadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!coordsResolved) return;
      if (hasLoadedRef.current) runSearch(0, { append: false, silent: true });
      hasLoadedRef.current = true;
    }, [coordsResolved, runSearch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSearch(0, { append: false, silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [runSearch]);

  const hasMore = chefs.length < total;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) runSearch(page + 1, { append: true });
  }, [hasMore, isLoadingMore, isLoading, page, runSearch]);

  const toggleCuisine = (code: string) => {
    setSelectedCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const activeFilterCount =
    selectedCuisines.size +
    (minRating > 0 ? 1 : 0) +
    (openNowOnly ? 1 : 0) +
    (sortBy !== "relevance" ? 1 : 0);

  const resetFilters = () => {
    setSelectedCuisines(new Set());
    setSortBy("relevance");
    setMinRating(0);
    setOpenNowOnly(false);
  };

  // Signed-in users go straight to the request form; otherwise send them to
  // login and preserve the destination so they land back here after signing in.
  const handlePostRequest = () => {
    if (dbUser) {
      router.push("/(tabs)/post-request");
    } else {
      router.push({
        pathname: "/(auth)/customer-login",
        params: { redirect: "/(tabs)/post-request" },
      });
    }
  };

  // Column width: 2 columns with a gap.
  const COLUMN_GAP = spacing.sm;
  const H_PADDING = spacing.md;
  const columnWidth = (width - H_PADDING * 2 - COLUMN_GAP) / 2;

  const renderItem = useCallback(
    ({ item }: { item: MappedChef }) => (
      <View style={{ width: columnWidth }}>
        <ChefCard {...item} onPress={() => router.push(`/chef/${item.id}/menu`)} />
      </View>
    ),
    [columnWidth]
  );

  const listHeader = (
    <Pressable style={styles.requestBanner} onPress={handlePostRequest}>
      <View style={styles.requestBannerText}>
        <Text style={styles.requestBannerTitle}>Want something specific?</Text>
        <Text style={styles.requestBannerBody}>
          Post a request and let home chefs bid to cook it for you.
        </Text>
      </View>
      <Ionicons name="arrow-forward-circle" size={28} color={colors.primaryForeground} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Logo size="md" showText={true} />
      </View>

      {/* Search + filters */}
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
            placeholder="Search kitchens or dishes..."
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
        <Pressable
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setFiltersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? colors.primaryForeground : colors.foreground}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterCountDot}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {total > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {total} chef{total !== 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {isLoading ? (
        <FullScreenLoader message="Finding home chefs..." />
      ) : fetchError ? (
        <EmptyState
          icon="👨‍🍳"
          title="Couldn't load chefs"
          description="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => runSearch(0, { append: false })}
        />
      ) : (
        <FlatList
          data={chefs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="No chefs found"
              description={
                activeFilterCount > 0 || debouncedSearch
                  ? "Try a different search or clear your filters."
                  : "No chefs are listed yet. Please check back soon."
              }
              actionLabel={
                activeFilterCount > 0 || debouncedSearch ? "Clear filters" : undefined
              }
              onAction={
                activeFilterCount > 0 || debouncedSearch
                  ? () => {
                      setSearchQuery("");
                      resetFilters();
                    }
                  : undefined
              }
            />
          }
        />
      )}

      {/* Filter sheet */}
      <Modal
        visible={filtersOpen}
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.sheet} edges={["top"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={() => setFiltersOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetSectionTitle}>Sort by</Text>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={styles.radioRow}
                onPress={() => setSortBy(option.value)}
              >
                <Ionicons
                  name={sortBy === option.value ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={sortBy === option.value ? colors.primary : colors.mutedForeground}
                />
                <Text style={styles.radioLabel}>{option.label}</Text>
              </Pressable>
            ))}
            {coords && (
              <Text style={styles.sheetHint}>
                Chefs nearest you lead the results whichever sort you pick.
              </Text>
            )}

            {cuisineTypes.length > 0 && (
              <>
                <Text style={styles.sheetSectionTitle}>Cuisine</Text>
                <View style={styles.chipsWrap}>
                  {cuisineTypes.map((cuisine) => {
                    const active = selectedCuisines.has(cuisine.code);
                    return (
                      <Pressable
                        key={cuisine.code}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleCuisine(cuisine.code)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {cuisine.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.sheetSectionTitle}>Minimum rating</Text>
            <View style={styles.chipsWrap}>
              {RATING_OPTIONS.map((rating) => {
                const active = minRating === rating;
                return (
                  <Pressable
                    key={rating}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setMinRating(rating)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {rating === 0 ? "Any" : `${rating}+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}>
                <Text style={styles.switchLabel}>Open now only</Text>
                <Text style={styles.switchHint}>
                  Hide chefs who are currently off-schedule.
                </Text>
              </View>
              <Switch
                value={openNowOnly}
                onValueChange={setOpenNowOnly}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </ScrollView>

          <View style={styles.sheetFooter}>
            <Button variant="outline" onPress={resetFilters} style={styles.sheetFooterButton}>
              Reset
            </Button>
            <Button onPress={() => setFiltersOpen(false)} style={styles.sheetFooterButton}>
              Show results
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
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

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    ...typography.base,
    color: colors.foreground,
  },
  filterButton: {
    width: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  filterButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterCountDot: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.destructive,
  },
  filterCountText: { fontSize: 10, fontWeight: "700", color: colors.white },

  countRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  countText: { ...typography.sm, color: colors.mutedForeground },

  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  requestBannerText: { flex: 1, gap: 2 },
  requestBannerTitle: {
    ...typography.base,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  requestBannerBody: {
    ...typography.xs,
    color: colors.primaryForeground,
    opacity: 0.9,
  },

  columnWrapper: { gap: spacing.sm },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  footerLoader: { paddingVertical: spacing.lg, alignItems: "center" },

  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.lg,
    fontFamily: fonts.sansBold,
    fontWeight: "700",
    color: colors.foreground,
  },
  sheetContent: { padding: spacing.md, paddingBottom: spacing["2xl"] },
  sheetSectionTitle: {
    ...typography.base,
    fontFamily: fonts.sansSemiBold,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetHint: {
    ...typography.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  radioLabel: { ...typography.base, color: colors.foreground },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.sm, color: colors.foreground },
  chipTextActive: { color: colors.primaryForeground, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  switchLabelWrap: { flex: 1, gap: 2 },
  switchLabel: { ...typography.base, color: colors.foreground },
  switchHint: { ...typography.xs, color: colors.mutedForeground },
  sheetFooter: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetFooterButton: { flex: 1 },
});
