import { userService } from "./userService";
import { Chef } from "./types";
import { dishService } from "./dishService";
import { apiRequest } from "./client";

export interface ChefDashboardStats {
  todays_orders: number;
  todays_earnings: number;
  happy_customers: number;
  rating: number;
}

export const chefService = {
  /**
   * Get all chefs with active listings, including computed price ranges.
   */
  getAllChefs: async (): Promise<Chef[]> => {
    try {
      const listings = await dishService.searchFood({ limit: 200 });

      // Compute min/max price per chef from their listings.
      // chef_id from the API is a numeric user ID (integer), so we key by String(numeric).
      const priceByChef = new Map<string, { min: number; max: number }>();
      listings.forEach(l => {
        if (!l.chef_id) return;
        const key = String(l.chef_id);
        const existing = priceByChef.get(key);
        if (!existing) {
          priceByChef.set(key, { min: l.price, max: l.price });
        } else {
          priceByChef.set(key, {
            min: Math.min(existing.min, l.price),
            max: Math.max(existing.max, l.price),
          });
        }
      });

      const chefIds = Array.from(new Set(listings.map(l => String(l.chef_id)).filter(Boolean)));

      const results = await Promise.allSettled(
        chefIds.map(id => chefService.getChef(id))
      );

      return results
        .filter((r): r is PromiseFulfilledResult<Chef> => r.status === "fulfilled")
        .map(r => {
          const chef = r.value;
          const prices = priceByChef.get(String(chef.id));
          return {
            ...chef,
            minPrice: prices?.min ?? 0,
            maxPrice: prices?.max ?? 0,
          };
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
