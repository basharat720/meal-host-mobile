import { apiRequest } from "./client";
import { Review } from "./types";

export const reviewService = {
  submitReview: (orderId: number, customerId: number, stars: number, comment?: string): Promise<Review> =>
    apiRequest<Review>("reviews/", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, customer_id: customerId, stars, comment }),
    }),

  getChefReviews: (chefId: number): Promise<Review[]> =>
    apiRequest<Review[]>(`reviews/?chef_id=${chefId}`),
};
