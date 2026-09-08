import { userService } from "./userService";
import { Chef, ChefListItem, ChefSearchParams, ChefSearchResult } from "./types";
import { apiRequest } from "./client";

export interface ChefEarningsSummary {
  total_orders: number;
  earning_orders: number;
  cancelled_orders: number;
  gross_sales: number;
  platform_fees: number;
  processor_fees: number;
  total_earnings: number;
  average_order_value: number;
}

export interface ChefEarningsOrder {
  id: number;
  created_at: string;
  status: string;
  payment_method: "cash" | "card" | null;
  customer_name: string | null;
  item_title: string | null;
  quantity: number;
  delivery_type: string;
  total_amount: number;
  /** null while the order has not reached an earning status. */
  chef_earnings: number | null;
  platform_fee: number | null;
  processor_fee: number | null;
  counts_towards_earnings: boolean;
  delivery_address: string | null;
  delivery_phone: string | null;
  special_instructions: string | null;
  cancellation_reason: string | null;
}

export interface ChefEarningsResponse {
  summary: ChefEarningsSummary;
  orders: ChefEarningsOrder[];
  total: number;
  skip: number;
  limit: number;
  start_date: string | null;
  end_date: string | null;
}

export interface ChefEarningsParams {
  /** Inclusive YYYY-MM-DD bounds; omit both for all time. */
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

export interface ChefDashboardStats {
  todays_orders: number;
  todays_earnings: number;
  happy_customers: number;
  rating: number;
  /** How many reviews the rating average is based on (backend 3ded2bc). */
  review_count: number;
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
   * Earnings and order history for the signed-in chef, for a date range.
   *
   * `summary` always covers the whole range; `orders` is one page of it, so
   * paging can load more without the totals moving.
   */
  getEarnings: async (params: ChefEarningsParams = {}): Promise<ChefEarningsResponse> => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);
    queryParams.append("skip", String(params.skip ?? 0));
    queryParams.append("limit", String(params.limit ?? 20));
    return apiRequest<ChefEarningsResponse>(`chefs/earnings?${queryParams.toString()}`);
  },

  /**
   * Get chef by firebase_uid (alias).
   */
  getChefByUserId: async (firebaseUid: string): Promise<Chef> => {
    return chefService.getChef(firebaseUid);
  }
};
