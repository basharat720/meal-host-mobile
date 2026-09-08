import { userService } from "./userService";
import { Chef, ChefListItem, ChefSearchParams, ChefSearchResult } from "./types";
import { apiRequest } from "./client";

export interface ChefDashboardStats {
  todays_orders: number;
  todays_earnings: number;
  happy_customers: number;
  rating: number;
}

export const chefService = {
  /**
   * Search chefs for the "Find Chefs" screen.
   *
   * The backend matches the search term against both the kitchen (name,
   * the chef's own name, specialties) and its menu, so "burgers" returns the
   * chefs who sell burgers along with the matching dishes in `matched_dishes`.
   * Filtering, sorting and pagination all happen server-side.
   */
  searchChefs: async (params: ChefSearchParams = {}): Promise<ChefSearchResult> => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append("query", params.query);
    params.cuisine_type_codes?.forEach((code) =>
      queryParams.append("cuisine_type_codes", code)
    );
    params.dietary_tag_codes?.forEach((code) =>
      queryParams.append("dietary_tag_codes", code)
    );
    if (params.min_price !== undefined) queryParams.append("min_price", String(params.min_price));
    if (params.max_price !== undefined) queryParams.append("max_price", String(params.max_price));
    if (params.min_rating !== undefined) queryParams.append("min_rating", String(params.min_rating));
    if (params.available_only) queryParams.append("available_only", "true");
    if (params.sort) queryParams.append("sort", params.sort);
    if (params.lat !== undefined) queryParams.append("lat", String(params.lat));
    if (params.lon !== undefined) queryParams.append("lon", String(params.lon));
    if (params.radius_km !== undefined) queryParams.append("radius_km", String(params.radius_km));
    queryParams.append("skip", String(params.skip ?? 0));
    queryParams.append("limit", String(params.limit ?? 24));

    const response = await apiRequest<{
      success: boolean;
      data: ChefListItem[];
      total: number;
    }>(`chefs?${queryParams.toString()}`);

    return { chefs: response.data ?? [], total: response.total ?? 0 };
  },

  /**
   * Get a single chef by their firebase_uid.
   */
  getChef: async (chefId: string): Promise<Chef> => {
    const user = await userService.getUserById(chefId);
    return {
      ...user,
      kitchen_name: user.chef_profile?.kitchen_name,
      kitchen_description: user.chef_profile?.kitchen_description,
      specialties: user.chef_profile?.specialties ?? [],
      dietary_tags: user.chef_profile?.dietary_tags ?? [],
      documents: user.chef_profile?.documents ?? [],
    };
  },

  /**
   * Get chef dashboard stats from the backend.
   */
  getDashboardStats: async (): Promise<ChefDashboardStats> => {
    return apiRequest<ChefDashboardStats>("chefs/dashboard/stats");
  },

  /**
   * Get chef by firebase_uid (alias).
   */
  getChefByUserId: async (firebaseUid: string): Promise<Chef> => {
    return chefService.getChef(firebaseUid);
  }
};
