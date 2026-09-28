import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  ActivityIndicator, Modal, ScrollView, RefreshControl, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { DishCard } from "@/components/DishCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { dishService, cuisineService } from "@/services/api";
import { CuisineType } from "@/services/types";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/contexts/AuthContext";
import {
  LocationPreference, LocationMode, RADIUS_OPTIONS, DEFAULT_LOCATION_PREFERENCE,
  loadLocationPreference, saveLocationPreference,
} from "@/lib/locationPreference";
import { colors, fonts, radius, spacing, typography } from "@/constants/theme";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { router, useFocusEffect } from "expo-router";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "topRated",  label: "Top Rated" },
  { value: "priceLow",  label: "Price: Low to High" },
  { value: "priceHigh", label: "Price: High to Low" },
];

const PAGE_SIZE = 12;

// Brand blue deepening into brand orange, matching the web request hero's
// primary → accent gradient.
const REQUEST_CTA_GRADIENT: [string, string, string] = [
  colors.gradientPrimaryStart,
  colors.primary,
  colors.accent,
];

export default function HomeScreen() {
  const { formatPrice } = useI18n();
  const { user, dbUser } = useAuth();
  const [allDishes, setAllDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Cache the resolved GPS coordinates so we don't re-prompt / re-locate on
  // every screen focus — we only need the device location once per session.
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const hasLoadedRef = useRef(false);

  // Where/how far to search. Loaded from storage on mount; `prefReady` gates the
  // first fetch so we don't fire once with the default and again with the stored
  // value (which could double-prompt for GPS).
  const [locationPref, setLocationPref] = useState<LocationPreference>(DEFAULT_LOCATION_PREFERENCE);
  const [prefReady, setPrefReady] = useState(false);
  // True when the user is on GPS mode but has denied the OS location permission.
  const [locationDenied, setLocationDenied] = useState(false);
  // Free-text address for "custom location" mode, plus its geocoding state.
  const [manualAddress, setManualAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // The user's saved profile address, if any — used by "profile" mode.
  const profileLocation = useMemo(() => {
    const loc = dbUser?.locations?.find((l) => l.is_primary) ?? dbUser?.locations?.[0];
    return loc ? { lat: loc.latitude, lon: loc.longitude, label: loc.address ?? "Saved address" } : null;
  }, [dbUser]);

  // API-driven cuisine types
  const [cuisineTypes, setCuisineTypes] = useState<CuisineType[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(new Set());
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Price-range filter. Kept as raw text so the numeric inputs can be cleared;
  // an empty min/max falls back to 0 / maxPrice respectively. `priceTouched`
  // keeps the filter inactive until the user actually edits a bound, so dishes
  // aren't silently hidden on first load.
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);

  // Pagination
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchDishes = useCallback(async (
    lat?: number,
    lon?: number,
    radiusKm?: number | null,
    silent = false,
    cuisineCodes: string[] = [],
  ) => {
    try {
      // On a silent refetch (screen refocus / pull-to-refresh) keep showing the
      // existing dishes instead of flashing the full-screen loader.
      if (!silent) setIsLoading(true);
      setFetchError(false);
      const params: any = { limit: 100 };
      // A null radius ("Any distance") or missing coordinates means "search
      // everywhere" — send an empty query so the backend returns all dishes.
      if (lat && lon && radiusKm != null) { params.lat = lat; params.lon = lon; params.radius_km = radiusKm; }
      else { params.query = ""; }
      // Filter by cuisine on the server too. The client-side pass below still
      // runs (it keeps the list responsive while this refetch is in flight), but
      // on its own it could only ever match within the 100-dish page we fetched,
      // so a matching dish outside that page looked like "no dishes found".
      if (cuisineCodes.length > 0) params.cuisine_type_codes = cuisineCodes;
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
        createdAt: d.created_at ? new Date(d.created_at).getTime() : 0,
      }));
      setAllDishes(mapped);
    } catch {
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resolve the coordinates to search from, based on the current preference.
  // Returns null when no coordinates are available (which fetchDishes treats as
  // "search everywhere"). Also toggles the "location denied" banner for GPS.
  const resolveCoords = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    if (locationPref.mode === "profile") {
      return profileLocation ? { lat: profileLocation.lat, lon: profileLocation.lon } : null;
    }
    if (locationPref.mode === "manual") {
      return locationPref.manual ? { lat: locationPref.manual.lat, lon: locationPref.manual.lon } : null;
    }
    // GPS: reuse the cached position when we have it, else request permission.
    if (coordsRef.current) { setLocationDenied(false); return coordsRef.current; }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        coordsRef.current = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setLocationDenied(false);
        return coordsRef.current;
      }
      setLocationDenied(true);
    } catch {
      setLocationDenied(true);
    }
    return null;
  }, [locationPref, profileLocation]);

  // Selected cuisine codes as a stable, sorted array so it can be a hook
  // dependency (a Set's identity changes on every toggle).
  const cuisineCodesKey = useMemo(
    () => Array.from(selectedCuisines).sort().join(","),
    [selectedCuisines],
  );

  // Fetch dishes for the current preference. `silent` keeps existing data on
  // screen while refetching (screen refocus / pull-to-refresh / filter change).
  const loadDishes = useCallback(async (silent = false) => {
    const cuisineCodes = cuisineCodesKey === "" ? [] : cuisineCodesKey.split(",");
    // "Any distance" needs no coordinates — search everywhere.
    if (locationPref.radiusKm == null) {
      await fetchDishes(undefined, undefined, null, silent, cuisineCodes);
      return;
    }
    const coords = await resolveCoords();
    await fetchDishes(coords?.lat, coords?.lon, locationPref.radiusKm, silent, cuisineCodes);
  }, [fetchDishes, resolveCoords, locationPref.radiusKm, cuisineCodesKey]);

  // Load the saved location preference once on mount.
  useEffect(() => {
    loadLocationPreference().then((pref) => {
      setLocationPref(pref);
      setManualAddress(pref.manual?.label ?? "");
      setPrefReady(true);
    });
  }, []);

  // Refetch every time the screen gains focus, once the preference is ready.
  // Also re-runs when the preference changes (loadDishes identity changes), so
  // adjusting location/radius updates results immediately. The first load shows
  // the full-screen loader; later loads refetch silently.
  useFocusEffect(
    useCallback(() => {
      if (!prefReady) return;
      loadDishes(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [loadDishes, prefReady])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDishes(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadDishes]);

  useEffect(() => {
    cuisineService.getCuisineTypes()
      .then(setCuisineTypes)
      .catch(() => {});
  }, []);

  // Merge a change into the location preference, persist it, and let the focus
  // effect pick up the new value for the next fetch.
  const updateLocationPref = useCallback((patch: Partial<LocationPreference>) => {
    setLocationPref((prev) => {
      const next = { ...prev, ...patch };
      saveLocationPreference(next);
      return next;
    });
  }, []);

  const setLocationMode = useCallback((mode: LocationMode) => {
    // Switching away from a stale denied-GPS state should clear the banner.
    if (mode !== "gps") setLocationDenied(false);
    updateLocationPref({ mode });
  }, [updateLocationPref]);

  // Geocode the typed address and switch to "custom location" mode.
  const applyManualLocation = useCallback(async () => {
    const query = manualAddress.trim();
    if (!query) return;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results?.[0]) {
        updateLocationPref({
          mode: "manual",
          manual: { lat: results[0].latitude, lon: results[0].longitude, label: query },
        });
        setLocationDenied(false);
      } else {
        Alert.alert("Location not found", "We couldn't find that place. Try a more specific address, city, or postal code.");
      }
    } catch {
      Alert.alert("Location error", "Couldn't look up that address. Please check your connection and try again.");
    } finally {
      setGeocoding(false);
    }
  }, [manualAddress, updateLocationPref]);

  const openLocationSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  // Upper bound for the price filter, derived from the actual dishes so that
  // higher-priced listings aren't excluded by a hardcoded default.
  const maxPrice = useMemo(() => {
    if (allDishes.length === 0) return 500;
    const highest = Math.max(...allDishes.map((d) => d.price ?? 0));
    return Math.max(500, Math.ceil(highest / 50) * 50);
  }, [allDishes]);

  // Effective price bounds: an empty input falls back to 0 / maxPrice.
  const priceLo = minPriceInput.trim() === "" ? 0 : Math.max(0, Number(minPriceInput) || 0);
  const priceHi = maxPriceInput.trim() === "" ? maxPrice : Math.max(0, Number(maxPriceInput) || 0);

  // Reset pagination when filters change
  useEffect(() => { setDisplayedCount(PAGE_SIZE); }, [searchQuery, sortBy, selectedCuisines, priceTouched, minPriceInput, maxPriceInput]);

  const filteredDishes = allDishes.filter((d) => {
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase()) && !d.chef.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCuisines.size > 0) {
      const hasCuisine = d.cuisineTypes?.some((ct: any) => selectedCuisines.has(ct.code));
      if (!hasCuisine) return false;
    }
    // Apply price filter only once the user has adjusted a bound.
    if (priceTouched && (d.price < priceLo || d.price > priceHi)) return false;
    return true;
  });

  // Offline chefs always sort last, matching the web behaviour
  const sortedDishes = [...filteredDishes].sort((a, b) => {
    if (a.chefIsAvailable !== b.chefIsAvailable) return a.chefIsAvailable ? -1 : 1;
    if (sortBy === "topRated") return b.rating - a.rating;
    if (sortBy === "priceLow") return a.price - b.price;
    if (sortBy === "priceHigh") return b.price - a.price;
    // relevance (default) — surface the newest dishes first
    return b.createdAt - a.createdAt;
  });

  const displayedDishes = sortedDishes.slice(0, displayedCount);
  const hasMore = displayedCount < sortedDishes.length;

  const hasActiveFilters = searchQuery !== "" || selectedCuisines.size > 0 || sortBy !== "relevance" || priceTouched;

  // Empty-state copy. A cuisine chip matches only dishes the chef actually
  // tagged with that cuisine, so name the cuisines when they're the active
  // filter — otherwise an untagged catalogue reads as a broken filter.
  const emptyDescription = useMemo(() => {
    if (selectedCuisines.size === 0) return "Try adjusting your search or filters.";
    const names = cuisineTypes
      .filter((c) => selectedCuisines.has(c.code))
      .map((c) => c.name);
    const label = names.length > 0 ? names.join(", ") : "that cuisine";
    return `No dishes are tagged ${label} in this area yet. Try another cuisine or widen your search area.`;
  }, [selectedCuisines, cuisineTypes]);

  // Human-readable heading describing what area the feed currently covers.
  const searchAreaLabel = useMemo(() => {
    if (locationPref.radiusKm == null) return "Popular Everywhere";
    if (locationPref.mode === "profile") return "Near Your Saved Address";
    if (locationPref.mode === "manual" && locationPref.manual) return `Near ${locationPref.manual.label}`;
    return "Popular Near You";
  }, [locationPref]);

  const resetFilters = () => {
    setSearchQuery("");
    setSortBy("relevance");
    setSelectedCuisines(new Set());
    setMinPriceInput("");
    setMaxPriceInput("");
    setPriceTouched(false);
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
    // The next page is already in memory — this only slices further into
    // sortedDishes, with no request behind it — so the delay exists purely to
    // let the spinner register. Web cut the same one to 200ms in 1da7c68.
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + PAGE_SIZE, sortedDishes.length));
      setIsLoadingMore(false);
    }, 200);
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
        <EmptyState icon="🍽️" title="Couldn't load dishes" description="The kitchen seems busy. Please check your connection and try again." actionLabel="Retry" onAction={() => loadDishes()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top bar with logo */}
      <View style={styles.topBar}>
        <Logo size="md" showText={true} />
        {user ? (
          <NotificationBell />
        ) : (
          <Pressable
            style={styles.signInButton}
            onPress={() => router.push("/(auth)/customer-login")}
            hitSlop={8}
          >
            <Ionicons name="person-outline" size={16} color={colors.primary} />
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        )}
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

      {/* Cuisine type chips from API. Rendered via a horizontal FlatList (not a
          ScrollView): the chips arrive asynchronously after mount, and on Android
          a ScrollView doesn't reliably re-run layout for late children, so they'd
          paint as blank pills until the next re-render. FlatList lays out arriving
          data correctly; extraData makes it re-render when the selection changes.

          The wrapper <View> is load-bearing: RN gives every horizontal
          ScrollView/FlatList `flexGrow: 1, flexShrink: 1` on its own style, so as
          a direct child of this column the row got squeezed (chips clipped in
          half) whenever the fixed header content plus the dish list overflowed the
          screen. Inside a plain View the row keeps its content height, and the
          vertical dish list absorbs the shrink instead — it scrolls anyway. */}
      {cuisineTypes.length > 0 && (
        <View style={styles.cuisineChipsContainer}>
          <FlatList
            horizontal
            data={cuisineTypes}
            keyExtractor={(cuisine) => cuisine.code}
            extraData={selectedCuisines}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cuisineChipsRow}
            style={styles.cuisineChipsList}
            renderItem={({ item: cuisine }) => (
              <Pressable
                style={[styles.cuisineChip, selectedCuisines.has(cuisine.code) && styles.cuisineChipActive]}
                onPress={() => toggleCuisine(cuisine.code)}
              >
                <Text style={[styles.cuisineChipText, selectedCuisines.has(cuisine.code) && styles.cuisineChipTextActive]}>
                  {cuisine.name}
                </Text>
              </Pressable>
            )}
            ListFooterComponent={
              selectedCuisines.size > 0 ? (
                <Pressable
                  style={styles.cuisineChipReset}
                  onPress={() => setSelectedCuisines(new Set())}
                >
                  <Ionicons name="close" size={14} color={colors.mutedForeground} />
                  <Text style={styles.cuisineChipResetText}>Reset</Text>
                </Pressable>
              ) : null
            }
          />
        </View>
      )}

      {/* Custom-request CTA — mirrors the web landing page's request hero: a
          prominent gradient card carrying the primary "post a request" action,
          plus a shortcut to the user's existing requests (previously only
          reachable from the Profile tab). */}
      <LinearGradient
        colors={REQUEST_CTA_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.requestCta}
      >
        <View style={styles.requestCtaHeader}>
          <View style={styles.requestCtaIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.white} />
          </View>
          <View style={styles.requestCtaCopy}>
            <Text style={styles.requestCtaTitle}>Want something specific? Request it!</Text>
            <Text style={styles.requestCtaSub}>
              Post your food request and let home chefs offer to cook it just for you.
            </Text>
          </View>
        </View>

        <View style={styles.requestCtaActions}>
          <Pressable
            style={({ pressed }) => [styles.requestCtaPrimary, pressed && styles.requestCtaPressed]}
            onPress={() => router.push("/(tabs)/post-request")}
          >
            <Ionicons name="add-circle" size={18} color={colors.primary} />
            <Text style={styles.requestCtaPrimaryText}>Post Your Request</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </Pressable>

          {user && (
            <Pressable
              style={({ pressed }) => [styles.requestCtaSecondary, pressed && styles.requestCtaPressed]}
              onPress={() => router.push("/(tabs)/my-requests")}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.white} />
              <Text style={styles.requestCtaSecondaryText}>My Requests</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* Location banner — surfaced when GPS is off so the "everything" fallback
          is explained and the user can set a search area. */}
      {locationPref.mode === "gps" && locationDenied && (
        <Pressable style={styles.locBanner} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="location-outline" size={16} color={colors.accent} />
          <Text style={styles.locBannerText}>Location is off, so we're showing dishes from everywhere. Tap to set a search area.</Text>
          <Text style={styles.locBannerAction}>Set</Text>
        </Pressable>
      )}

      {/* Results header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>{searchAreaLabel}</Text>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState icon="🔍" title="No dishes found" description={emptyDescription} actionLabel="Clear Filters" onAction={resetFilters} />
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
            {/* Search area — where to search from and how far */}
            <Text style={styles.sectionTitle}>Search area</Text>
            <View style={styles.locModeRow}>
              <Pressable
                style={[styles.locMode, locationPref.mode === "gps" && styles.locModeActive]}
                onPress={() => setLocationMode("gps")}
              >
                <Ionicons name="navigate-outline" size={16} color={locationPref.mode === "gps" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.locModeText, locationPref.mode === "gps" && styles.locModeTextActive]}>Current location</Text>
              </Pressable>
              {profileLocation && (
                <Pressable
                  style={[styles.locMode, locationPref.mode === "profile" && styles.locModeActive]}
                  onPress={() => setLocationMode("profile")}
                >
                  <Ionicons name="home-outline" size={16} color={locationPref.mode === "profile" ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.locModeText, locationPref.mode === "profile" && styles.locModeTextActive]}>Saved address</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.locMode, locationPref.mode === "manual" && styles.locModeActive]}
                onPress={() => setLocationMode("manual")}
              >
                <Ionicons name="location-outline" size={16} color={locationPref.mode === "manual" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.locModeText, locationPref.mode === "manual" && styles.locModeTextActive]}>Custom</Text>
              </Pressable>
            </View>

            {/* Contextual detail for the chosen mode */}
            {locationPref.mode === "gps" && locationDenied && (
              <View style={styles.locNotice}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
                <Text style={styles.locNoticeText}>
                  Location is turned off for the app. Enable it in Settings, or pick a saved/custom location instead.
                </Text>
                <Pressable onPress={openLocationSettings} hitSlop={6}>
                  <Text style={styles.locNoticeLink}>Open Settings</Text>
                </Pressable>
              </View>
            )}
            {locationPref.mode === "profile" && (
              <Text style={styles.locDetail} numberOfLines={2}>
                {profileLocation?.label}
              </Text>
            )}
            {locationPref.mode === "manual" && (
              <View style={styles.manualRow}>
                <View style={styles.manualInputWrap}>
                  <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={styles.manualInput}
                    placeholder="Enter a city, area or address"
                    placeholderTextColor={colors.mutedForeground}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    returnKeyType="search"
                    onSubmitEditing={applyManualLocation}
                  />
                </View>
                <Pressable
                  style={[styles.manualBtn, (!manualAddress.trim() || geocoding) && styles.manualBtnDisabled]}
                  onPress={applyManualLocation}
                  disabled={!manualAddress.trim() || geocoding}
                >
                  {geocoding
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.manualBtnText}>Set</Text>}
                </Pressable>
              </View>
            )}
            {locationPref.mode === "manual" && locationPref.manual && (
              <Text style={styles.locDetail} numberOfLines={2}>
                Searching around: {locationPref.manual.label}
              </Text>
            )}

            {/* Distance / radius */}
            <Text style={styles.sectionSubTitle}>Distance</Text>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((opt) => {
                const active = locationPref.radiusKm === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    style={[styles.radiusChip, active && styles.radiusChipActive]}
                    onPress={() => updateLocationPref({ radiusKm: opt.value })}
                  >
                    <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {locationPref.radiusKm == null && (
              <Text style={styles.priceHint}>Showing dishes everywhere, regardless of distance.</Text>
            )}

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

            {/* Price range */}
            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.priceRow}>
              <Input
                containerStyle={styles.priceInput}
                label="Min"
                placeholder={formatPrice(0)}
                keyboardType="numeric"
                value={minPriceInput}
                onChangeText={(text) => {
                  setMinPriceInput(text.replace(/[^0-9.]/g, ""));
                  setPriceTouched(true);
                }}
              />
              <Text style={styles.priceDash}>–</Text>
              <Input
                containerStyle={styles.priceInput}
                label="Max"
                placeholder={formatPrice(maxPrice)}
                keyboardType="numeric"
                value={maxPriceInput}
                onChangeText={(text) => {
                  setMaxPriceInput(text.replace(/[^0-9.]/g, ""));
                  setPriceTouched(true);
                }}
              />
            </View>
            <Text style={styles.priceHint}>
              {priceTouched
                ? `Showing ${formatPrice(priceLo)} – ${formatPrice(priceHi)}`
                : `Dishes range up to ${formatPrice(maxPrice)}`}
            </Text>

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
  signInButton: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
  },
  signInButtonText: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.primary },
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

  // Cuisine chips horizontal scroll. No maxHeight on purpose: the row must be
  // free to size to the chips, which grow with the device's font scale.
  cuisineChipsContainer: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  cuisineChipsList: { flexGrow: 0, flexShrink: 0 },
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
  // System font (fontWeight, no custom fontFamily) on purpose: a custom-font
  // <Text> that first mounts via the async cuisine fetch renders blank on iOS
  // until a re-render. Dish titles avoid this by using fontWeight too.
  cuisineChipText: { ...typography.sm, fontWeight: "600", color: colors.mutedForeground },
  cuisineChipTextActive: { color: colors.white, fontWeight: "600" },
  cuisineChipReset: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  cuisineChipResetText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },

  // Custom-request CTA
  requestCta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.md,
    // Lift the card off the feed the way the web hero's shadow does.
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  requestCtaHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  requestCtaIcon: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  requestCtaCopy: { flex: 1, gap: 2 },
  requestCtaTitle: { ...typography.md, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.white },
  requestCtaSub: { ...typography.xs, fontFamily: fonts.sans, color: "rgba(255,255,255,0.88)" },
  requestCtaActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  requestCtaPrimary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, height: 42, paddingHorizontal: spacing.md,
    borderRadius: radius.full, backgroundColor: colors.white,
  },
  requestCtaPrimaryText: { ...typography.sm, fontFamily: fonts.sansBold, fontWeight: "700", color: colors.primary },
  requestCtaSecondary: {
    flexDirection: "row", alignItems: "center", gap: 6,
    height: 42, paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  requestCtaSecondaryText: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.white },
  requestCtaPressed: { opacity: 0.85 },

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
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  priceInput: { flex: 1 },
  priceDash: { ...typography.base, color: colors.mutedForeground, paddingBottom: 11 },
  priceHint: { ...typography.xs, fontFamily: fonts.sans, color: colors.mutedForeground, marginTop: spacing.xs },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap" },
  modalCuisineChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginRight: spacing.sm, marginBottom: spacing.sm },
  modalCuisineChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  modalCuisineText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  modalCuisineTextActive: { color: colors.white, fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  modalFooter: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  modalBtn: { flex: 1 },

  // Search-area controls
  sectionSubTitle: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.foreground, marginTop: spacing.md, marginBottom: spacing.sm },
  locModeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  locMode: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  locModeActive: { borderColor: colors.primary, backgroundColor: colors.lightSage },
  locModeText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  locModeTextActive: { color: colors.primary, fontFamily: fonts.sansSemiBold, fontWeight: "600" },
  locDetail: { ...typography.xs, fontFamily: fonts.sans, color: colors.mutedForeground, marginTop: spacing.sm },
  locNotice: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginTop: spacing.sm, padding: spacing.sm,
    borderRadius: radius.md, backgroundColor: `${colors.accent}18`,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  locNoticeText: { flex: 1, ...typography.xs, fontFamily: fonts.sans, color: colors.foreground },
  locNoticeLink: { ...typography.xs, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.accent },
  manualRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  manualInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44,
  },
  manualInput: { flex: 1, ...typography.base, color: colors.foreground },
  manualBtn: {
    height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  manualBtnDisabled: { opacity: 0.5 },
  manualBtnText: { ...typography.sm, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.white },
  radiusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  radiusChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  radiusChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  radiusChipText: { ...typography.sm, fontFamily: fonts.sans, color: colors.mutedForeground },
  radiusChipTextActive: { color: colors.white, fontFamily: fonts.sansSemiBold, fontWeight: "600" },

  // Main-screen location banner
  locBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginHorizontal: spacing.md, marginTop: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: `${colors.accent}18`, borderRadius: radius.lg,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  locBannerText: { flex: 1, ...typography.xs, fontFamily: fonts.sans, color: colors.foreground },
  locBannerAction: { ...typography.xs, fontFamily: fonts.sansSemiBold, fontWeight: "600", color: colors.accent },
});
