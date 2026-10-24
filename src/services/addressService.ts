import { apiRequest } from "./client";
import { UserLocationResponse } from "./types";

/**
 * The signed-in user's saved delivery addresses (`/users/me/locations`).
 *
 * The location picker at the top of Home and Find Chefs manages these.
 * Choosing one never changes which address is the profile (primary) address —
 * that is still edited on the Profile tab. Mirrors
 * meal-host-frontend/src/services/addressService.ts; see
 * feature-docs/12-delivery-address-in-the-app.md.
 */

export type SavedAddress = UserLocationResponse;

export interface SavedAddressInput {
  latitude: number;
  longitude: number;
  address?: string;
  label?: string;
  house_number: string;
  street?: string;
  building_floor?: string;
  delivery_instructions?: string;
}

/** Codes the delete endpoint refuses with, so the picker can explain why. */
export const PRIMARY_ADDRESS = "PRIMARY_ADDRESS";
export const ADDRESS_IN_USE = "ADDRESS_IN_USE";

export const addressService = {
  list: async (): Promise<SavedAddress[]> => {
    return apiRequest<SavedAddress[]>("users/me/locations");
  },

  create: async (input: SavedAddressInput): Promise<SavedAddress> => {
    return apiRequest<SavedAddress>("users/me/locations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (id: number, input: Partial<SavedAddressInput>): Promise<SavedAddress> => {
    return apiRequest<SavedAddress>(`users/me/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove: async (id: number): Promise<void> => {
    await apiRequest<void>(`users/me/locations/${id}`, { method: "DELETE" });
  },
};

/** The short line the pill shows for an address, e.g. "House 12, Street 7". */
export const addressTitle = (
  a: Pick<SavedAddress, "house_number" | "street" | "address">
): string => {
  const head = [a.house_number, a.street].filter(Boolean).join(", ");
  return head || a.address || "Saved address";
};

/** The full one-line address used as an order's delivery address. */
export const formatFullAddress = (
  a: Pick<SavedAddress, "house_number" | "street" | "building_floor" | "address">
): string => {
  const head = [a.house_number, a.street, a.building_floor].filter(Boolean).join(", ");
  if (!a.address) return head;
  return head ? `${head} — ${a.address}` : a.address;
};
