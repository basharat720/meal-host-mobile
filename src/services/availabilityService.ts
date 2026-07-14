import { apiRequest, publicApiRequest } from "./client";
import { AvailabilitySlot, ChefAvailabilityStatus } from "./types";

export const availabilityService = {
  getAvailability: (chefId: number): Promise<AvailabilitySlot[]> =>
    apiRequest<AvailabilitySlot[]>(`chefs/${chefId}/availability`),

  /**
   * Whether a chef is currently open for orders, and when they next open.
   * Public (no auth) so it can power the chef profile + menu screens.
   */
  getStatus: (chefId: number | string): Promise<ChefAvailabilityStatus> =>
    publicApiRequest<ChefAvailabilityStatus>(`chefs/${chefId}/availability/status`),

  setAvailability: (chefId: number, slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> =>
    apiRequest<AvailabilitySlot[]>(`chefs/${chefId}/availability?user_id=${chefId}`, {
      method: "PUT",
      body: JSON.stringify({ slots }),
    }),
};
