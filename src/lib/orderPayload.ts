import type { CartItem } from "@/contexts/CartContext";
import type { OrderCreate, OrderItemCreate } from "@/services/types";

export interface ListingOrderDetails {
  deliveryType: "pickup" | "delivery";
  deliveryAddress?: string;
  deliveryPhone?: string;
  specialInstructions?: string;
  /** Live position, forwarded verbatim to the delivery-zone check. */
  locationPayload?: {
    customer_latitude?: number;
    customer_longitude?: number;
    customer_location_accuracy_m?: number;
  };
}

/** One requested line: the dish, the variant chosen on it, and how many. */
export const buildOrderItem = (item: CartItem): OrderItemCreate => {
  const foodListingId = Number(item.foodListingId);
  if (!Number.isInteger(foodListingId) || foodListingId <= 0) {
    throw new Error(`Invalid food listing ID: ${item.foodListingId}`);
  }
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
    throw new Error("Order quantity must be between 1 and 100");
  }

  return {
    food_listing_id: foodListingId,
    ...(item.variantId !== undefined
      ? { food_listing_variant_id: item.variantId }
      : {}),
    quantity: item.quantity,
  };
};

const orderDetails = (details: ListingOrderDetails) => ({
  delivery_type: details.deliveryType,
  ...(details.deliveryAddress ? { delivery_address: details.deliveryAddress } : {}),
  ...(details.deliveryPhone ? { delivery_phone: details.deliveryPhone } : {}),
  ...(details.specialInstructions
    ? { special_instructions: details.specialInstructions }
    : {}),
  ...(details.locationPayload ?? {}),
});

/**
 * The whole cart as ONE order, one line per dish/variant.
 *
 * A cart is restricted to a single kitchen, so everything in it belongs on one
 * order: the chef gets a single order number for what is one bag of food.
 * Nothing price-bearing is sent — the server prices every line from the dish
 * and the variant chosen on it, and rejects a payload that tries to say what
 * anything costs.
 */
export const buildCartOrderPayload = (
  items: CartItem[],
  details: ListingOrderDetails,
): OrderCreate => {
  if (items.length === 0) {
    throw new Error("Your cart is empty");
  }
  if (new Set(items.map((item) => item.chefId)).size > 1) {
    throw new Error("All dishes in an order must come from the same kitchen");
  }

  const lines = items.map(buildOrderItem);
  const seen = new Set(
    lines.map((line) => `${line.food_listing_id}:${line.food_listing_variant_id ?? ""}`),
  );
  if (seen.size !== lines.length) {
    throw new Error("The same dish appears more than once; combine it into one line");
  }

  return {
    items: lines,
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...orderDetails(details),
  };
};

/** A single dish as its own order. Kept for the one-dish paths. */
export const buildListingOrderPayload = (
  item: CartItem,
  details: ListingOrderDetails,
): OrderCreate => {
  const line = buildOrderItem(item);
  return {
    food_listing_id: line.food_listing_id,
    ...(line.food_listing_variant_id !== undefined
      ? { food_listing_variant_id: line.food_listing_variant_id }
      : {}),
    quantity: line.quantity,
    ...orderDetails(details),
  };
};
