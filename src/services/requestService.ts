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

  acceptOffer: async (offerId: number): Promise<Order> => {
    return apiRequest<Order>(`requests/offers/${offerId}/accept`, {
      method: "POST",
    });
  },

  rejectOffer: async (offerId: number, reason?: string): Promise<Offer> => {
    return apiRequest<Offer>(`requests/offers/${offerId}/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },
};
