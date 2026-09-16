import { apiRequest } from "./client";
import { ChefListItem, FoodListing } from "./types";

/** What a favorite points at. Matches the backend's `FavoriteType`. */
export type FavoriteType = "chef" | "dish";

export interface FavoriteIds {
  chef_ids: number[];
  dish_ids: number[];
}

export const favoriteService = {
  /**
   * Every favorited ID for the signed-in user, in one call. The cards across the
   * app paint their hearts from this rather than each asking about itself.
   */
  getIds: (): Promise<FavoriteIds> => apiRequest<FavoriteIds>("favorites/ids"),

  /** Chef rows come back in the same shape as `/chefs`, so the chef card reads them unchanged. */
  getChefs: (): Promise<ChefListItem[]> => apiRequest<ChefListItem[]>("favorites/chefs"),

  getDishes: (): Promise<FoodListing[]> => apiRequest<FoodListing[]>("favorites/dishes"),

  /** Idempotent — favoriting something already saved is not an error. */
  add: (type: FavoriteType, id: number): Promise<FavoriteIds> =>
    apiRequest<FavoriteIds>("favorites", {
      method: "POST",
      body: JSON.stringify({ type, id }),
    }),

  remove: (type: FavoriteType, id: number): Promise<void> =>
    apiRequest<void>(`favorites/${type}/${id}`, { method: "DELETE" }),

  /** "Unfavorite all" for one kind; the other kind is left alone. */
  clear: (type: FavoriteType): Promise<void> =>
    apiRequest<void>(`favorites/${type}`, { method: "DELETE" }),
};
