import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { favoriteService, FavoriteType } from "@/services/favoriteService";

interface FavoritesContextType {
  /** Is this chef/dish saved? Always false while signed out. */
  isFavorite: (type: FavoriteType, id: number | string) => boolean;
  /** Save or unsave. Signed-out users are offered the sign-in screen instead. */
  toggleFavorite: (type: FavoriteType, id: number | string) => void;
  chefIds: number[];
  dishIds: number[];
  loading: boolean;
  /** Re-read from the server — used after a bulk clear on the favorites screen. */
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

/**
 * Holds the signed-in user's favorited IDs for the whole app.
 *
 * One fetch on sign-in feeds every heart on every card, rather than each card
 * asking about itself. Tapping updates the local set immediately and rolls back
 * if the request fails, so the heart never lags behind the tap.
 */
export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [chefIds, setChefIds] = useState<number[]>([]);
  const [dishIds, setDishIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setChefIds([]);
      setDishIds([]);
      return;
    }
    setLoading(true);
    try {
      const ids = await favoriteService.getIds();
      setChefIds(ids.chef_ids ?? []);
      setDishIds(ids.dish_ids ?? []);
    } catch (e) {
      // A failed load leaves the hearts empty rather than blocking browsing —
      // favorites are an accent, not something to fail a screen over.
      console.error("Failed to load favorites", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const isFavorite = useCallback(
    (type: FavoriteType, id: number | string) => {
      const numeric = Number(id);
      return type === "chef" ? chefIds.includes(numeric) : dishIds.includes(numeric);
    },
    [chefIds, dishIds],
  );

  const toggleFavorite = useCallback(
    (type: FavoriteType, id: number | string) => {
      if (!user) {
        Alert.alert(
          "Sign in to save favorites",
          "Your saved kitchens and dishes are kept with your account.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Sign in", onPress: () => router.push("/(auth)/customer-login") },
          ],
        );
        return;
      }

      const numeric = Number(id);
      if (Number.isNaN(numeric)) return;

      const setIds = type === "chef" ? setChefIds : setDishIds;
      const currentlySaved = isFavorite(type, numeric);

      // Optimistic: the heart fills on tap, and only rolls back if the server
      // refuses.
      setIds(prev => (currentlySaved ? prev.filter(x => x !== numeric) : [...prev, numeric]));

      const request = currentlySaved
        ? favoriteService.remove(type, numeric)
        : favoriteService.add(type, numeric);

      request.catch(() => {
        setIds(prev => (currentlySaved ? [...prev, numeric] : prev.filter(x => x !== numeric)));
        Alert.alert(
          currentlySaved ? "Couldn't remove from favorites" : "Couldn't save to favorites",
          "Please check your connection and try again.",
        );
      });
    },
    [user, isFavorite],
  );

  return (
    <FavoritesContext.Provider
      value={{ isFavorite, toggleFavorite, chefIds, dishIds, loading, refresh }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
};
