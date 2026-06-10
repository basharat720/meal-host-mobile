import { apiRequest, publicApiRequest } from "./client";
import {
  FoodListing,
  FoodListingCreate,
  FoodListingUpdate,
  FoodImage,
  DietaryTag,
} from "./types";

export const menuService = {
  // Keeping name for compatibility, but updated logic
  /**
   * Create a new listing
   */
  createListing: async (listing: FoodListingCreate): Promise<FoodListing> => {
    return apiRequest<FoodListing>("chefs/listings", {
      method: "POST",
      body: JSON.stringify(listing),
    });
  },

  /**
   * Get all listings (optionally filtered by chef_id)
   */
  getListings: async (chefId?: string): Promise<FoodListing[]> => {
    const url = chefId ? `food/listings?chef_id=${chefId}` : "food/listings";
    return apiRequest<FoodListing[]>(url);
  },

  /**
   * Get a chef's listings by their ID
   */
  getChefListings: async (chefId: string): Promise<FoodListing[]> => {
    return apiRequest<FoodListing[]>(`/chefs/${chefId}/listings`);
  },

  /**
   * Get a chef's public listings by their ID
   */
  getChefListingsPublic: async (chefId: string): Promise<FoodListing[]> => {
    return publicApiRequest<FoodListing[]>(`chefs/${chefId}/listings`);
  },

  /**
   * Get a single listing
   */
  getListing: async (listingId: number): Promise<FoodListing> => {
    return apiRequest<FoodListing>(`food/listings/${listingId}`);
  },

  /**
   * Update a listing
   */
  updateListing: async (
    listingId: number,
    update: FoodListingUpdate,
  ): Promise<FoodListing> => {
    return apiRequest<FoodListing>(`chefs/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
  },

  /**
   * Delete a listing
   */
  deleteListing: async (listingId: number): Promise<void> => {
    return apiRequest<void>(`chefs/listings/${listingId}`, {
      method: "DELETE",
    });
  },

  /**
   * Add image to listing
   */
  addImage: async (
    listingId: number,
    imageUrl: string,
    isPrimary: boolean,
  ): Promise<FoodImage> => {
    return apiRequest<FoodImage>(`chefs/listings/${listingId}/images`, {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, is_primary: isPrimary }),
    });
  },

  /**
   * Get all dietary tags
   */
  getDietaryTags: async (): Promise<DietaryTag[]> => {
    return apiRequest<DietaryTag[]>("food/tags");
  },
};
