import { apiRequest } from "./client";
import { FoodRequest, FoodRequestCreate, Offer, OfferCreate, Order, PaginatedResponse } from "./types";

export const requestService = {
  createRequest: async (data: FoodRequestCreate): Promise<FoodRequest> => {
    return apiRequest<FoodRequest>("requests/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getOpenRequests: async (): Promise<FoodRequest[]> => {
    const res = await apiRequest<PaginatedResponse<FoodRequest> | FoodRequest[]>("requests/?status=OPEN");
    return Array.isArray(res) ? res : res.items;
  },

  getAllAccessibleRequests: async (): Promise<FoodRequest[]> => {
    const res = await apiRequest<PaginatedResponse<FoodRequest> | FoodRequest[]>("requests/");
    return Array.isArray(res) ? res : res.items;
  },

  getCustomerRequests: async (
    customerId: number,
    skip = 0,
    limit = 20
  ): Promise<PaginatedResponse<FoodRequest>> => {
    return apiRequest<PaginatedResponse<FoodRequest>>(`requests/?customer_id=${customerId}&skip=${skip}&limit=${limit}`);
  },

  /**
   * What the Home tracker needs: how many of the customer's requests are open
   * and how many offers on them await an answer. `pendingOffers` is null when
   * the server does not send offer counts.
   */
  getOpenRequestSummary: async (
    customerId: number
  ): Promise<{ openCount: number; pendingOffers: number | null; onlyRequestId: number | null }> => {
    const page = await apiRequest<PaginatedResponse<FoodRequest>>(
      `requests/?customer_id=${customerId}&status=OPEN&limit=50`
    );
    const counted = page.items.every((r) => typeof r.pending_offer_count === "number");
    return {
      openCount: page.total,
      pendingOffers: counted
        ? page.items.reduce((sum, r) => sum + (r.pending_offer_count ?? 0), 0)
        : null,
      onlyRequestId: page.total === 1 && page.items.length === 1 ? page.items[0].id : null,
    };
  },

  getRequestById: async (requestId: number): Promise<FoodRequest> => {
    return apiRequest<FoodRequest>(`requests/${requestId}`);
  },

  getRequestOffers: async (requestId: number): Promise<Offer[]> => {
    return apiRequest<Offer[]>(`requests/${requestId}/offers`);
  },

  makeOffer: async (
    requestId: number,
    chefId: number,
    data: OfferCreate
  ): Promise<Offer> => {
    return apiRequest<Offer>(
      `requests/${requestId}/offers?chef_id=${chefId}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  acceptOffer: async (
    offerId: number,
    /**
     * The customer's confirmed position, so the server checks the same place
     * the app did. Optional: without it the server falls back to their saved
     * primary location.
     */
    location?: {
      customer_latitude?: number;
      customer_longitude?: number;
      customer_location_accuracy_m?: number;
    }
  ): Promise<Order> => {
    return apiRequest<Order>(`requests/offers/${offerId}/accept`, {
      method: "POST",
      body: JSON.stringify(location ?? {}),
    });
  },

  /**
   * The customer withdraws their own open request. Pending offers on it are
   * closed and their chefs told. 403 if not the owner, 409 if already closed.
   */
  withdrawRequest: async (requestId: number, reason?: string): Promise<FoodRequest> => {
    const trimmed = reason?.trim();
    return apiRequest<FoodRequest>(`requests/${requestId}/withdraw`, {
      method: "POST",
      body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
    });
  },

  /** Recently closed requests the chef can see, newest first. */
  getClosedRequests: async (limit = 50): Promise<FoodRequest[]> => {
    const res = await apiRequest<PaginatedResponse<FoodRequest> | FoodRequest[]>(
      `requests/?status=CLOSED&limit=${limit}`
    );
    return Array.isArray(res) ? res : res.items;
  },

  rejectOffer: async (offerId: number, reason?: string): Promise<Offer> => {
    return apiRequest<Offer>(`requests/offers/${offerId}/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },
};
