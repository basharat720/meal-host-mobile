import { apiRequest } from "./client";
import { AvailabilitySlot } from "./types";

export const availabilityService = {
  getAvailability: (chefId: number): Promise<AvailabilitySlot[]> =>
    apiRequest<AvailabilitySlot[]>(`chefs/${chefId}/availability`),

  setAvailability: (chefId: number, slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> =>
    apiRequest<AvailabilitySlot[]>(`chefs/${chefId}/availability?user_id=${chefId}`, {
      method: "PUT",
      body: JSON.stringify({ slots }),
    }),
};
