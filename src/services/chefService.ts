import { userService } from "./userService";
import { Chef, ChefListItem } from "./types";
import { apiRequest } from "./client";

export interface ChefDashboardStats {
  todays_orders: number;
  todays_earnings: number;
  happy_customers: number;
  rating: number;
}

export const chefService = {
  /**
   * Get all active chefs in one call via the optimized backend endpoint, which
   * returns each chef's profile, locations, price range, and current
   * availability (is_available). Sorted open-first, then by rating (matches web).
   */
  getAllChefs: async (): Promise<ChefListItem[]> => {
    try {
      const response = await apiRequest<{ success: boolean; data: ChefListItem[]; total: number }>(
        "chefs?limit=100"
      );
      const chefs = response.data ?? [];
      return [...chefs].sort((a, b) => {
        const availA = a.is_available !== false;
        const availB = b.is_available !== false;
        if (availA !== availB) return availA ? -1 : 1;
        return (b.chef_profile?.rating_avg ?? 0) - (a.chef_profile?.rating_avg ?? 0);
      });
    } catch (e) {
      console.error("Failed to fetch chefs", e);
      return [];
    }
  },

  /**
   * Get a single chef by their firebase_uid.
   */
  getChef: async (chefId: string): Promise<Chef> => {
    const user = await userService.getUserById(chefId);
    return {
      ...user,
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
