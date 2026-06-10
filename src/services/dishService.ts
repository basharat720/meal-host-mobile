import { apiRequest } from "./client";
import { FoodListing } from "./types";

export const dishService = {
  /**
   * Search food listings
   */
  searchFood: async (filters: {
    lat?: number;
    lon?: number;
    radius_km?: number;
    query?: string;
    dietary_tag_codes?: string[];
    skip?: number;
    limit?: number;
  }): Promise<FoodListing[]> => {
    const queryParams = new URLSearchParams();
    if (filters.lat) queryParams.append("lat", String(filters.lat));
    if (filters.lon) queryParams.append("lon", String(filters.lon));
    if (filters.radius_km) queryParams.append("radius_km", String(filters.radius_km));
    // Check if query is defined (even if empty string) to allow "search all"
    if (filters.query !== undefined) queryParams.append("query", filters.query);
    if (filters.dietary_tag_codes) {
        filters.dietary_tag_codes.forEach(tag => queryParams.append("dietary_tag_codes", tag));
    }
    if (filters.skip !== undefined) queryParams.append("skip", String(filters.skip));
    if (filters.limit !== undefined) queryParams.append("limit", String(filters.limit));

    const queryString = queryParams.toString();
    // User explicitly requested /food/search to be used on home page
    // We append a wildcard or empty query if no other filters exist to encourage backend to return "all"
    if (!filters.lat && !filters.lon && !filters.query && !filters.dietary_tag_codes) {
        // Some search implementations require *some* query param. 
        // We'll try sending an empty query if supported, or just rely on the endpoint behavior.
        // If the backend treats missing query as "search all", this is fine.
        // If it treats it as "search nothing", we might need query=""
        if (!queryParams.has("query")) {
             // queryParams.append("query", ""); // Uncomment if backend requires explicit empty query
        }
    }
    
    // Fallback: If no location/query provided, we might want to default to fetching listings via search
    // But since we removed the listings endpoint fallback, we rely solely on search.
    
    const endpoint = queryString ? `food/search?${queryString}` : "food/search";
    
    return apiRequest<FoodListing[]>(endpoint);
  },

  /**
   * Get a single dish (listing)
   */
  getDish: async (dishId: number): Promise<FoodListing> => {
    return apiRequest<FoodListing>(`food/listings/${dishId}`);
  },

  /**
   * Get the tentative delivery estimate for a dish.
   */
  getListingEta: async (
    dishId: number,
  ): Promise<{ tentative_eta_min_minutes: number; tentative_eta_max_minutes: number }> => {
    return apiRequest(`food/listings/${dishId}/eta`);
  },
};
