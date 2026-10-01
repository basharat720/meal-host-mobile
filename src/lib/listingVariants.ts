import type {
  FoodListing,
  FoodListingVariant,
  FoodListingVariantInput,
  Order,
  OrderItem,
} from "@/services/types";

import { toTitleCase } from "@/lib/titleCase";

export const MAX_LISTING_VARIANTS = 10;
export const MAX_VARIANT_NAME_LENGTH = 80;

export type PricingMode = "single" | "variants";

/** One row of the chef's variant editor. Prices stay strings while typing. */
export interface ListingVariantField {
  id?: number;
  name: string;
  price: string;
}

export interface ListingPricingState {
  mode: PricingMode;
  price: string;
  variantLabel: string;
  variants: ListingVariantField[];
}

export type ListingPricingPayload = {
  price: number | null;
  variant_label: string | null;
  variants: FoodListingVariantInput[];
};

export const DEFAULT_VARIANT_LABEL = "Choose an option";

export const emptyVariantField = (): ListingVariantField => ({ name: "", price: "" });

export const sortListingVariants = <T extends Pick<FoodListingVariant, "display_order">>(
  variants: T[],
): T[] => [...variants].sort((left, right) => left.display_order - right.display_order);

export const getActiveListingVariants = (
  variants: FoodListingVariant[],
): FoodListingVariant[] =>
  sortListingVariants(variants.filter((variant) => !variant.archived_at));

export const getListingStartingPrice = (
  listing: Pick<FoodListing, "price" | "starting_price">,
): number | null => listing.starting_price ?? listing.price;

export const getListingPriceLabel = (
  listing: Pick<FoodListing, "price" | "starting_price" | "has_variants">,
  formatPrice: (price: number) => string,
): string => {
  const price = getListingStartingPrice(listing);
  if (price === null || price === undefined) return "Price unavailable";
  return listing.has_variants ? `From ${formatPrice(price)}` : formatPrice(price);
};

export const validateListingPrice = (price: number | null): string | null =>
  price !== null && Number.isFinite(price) && price > 0
    ? null
    : "Enter a price greater than zero";

export const validateListingVariants = (
  variants: FoodListingVariantInput[],
): string | null => {
  if (variants.length === 0) return "Add at least one option";
  if (variants.length > MAX_LISTING_VARIANTS) {
    return "A listing can have at most 10 options";
  }

  const names = new Set<string>();
  for (const variant of variants) {
    const name = variant.name.trim();
    if (!name) return "Every option needs a name";
    if (name.length > MAX_VARIANT_NAME_LENGTH) {
      return "Option names must be 80 characters or fewer";
    }

    const normalizedName = name.toLocaleLowerCase();
    if (names.has(normalizedName)) return "Option names must be unique";
    names.add(normalizedName);

    if (!Number.isFinite(variant.price) || variant.price <= 0) {
      return "Every option needs a price greater than zero";
    }
  }

  return null;
};

/**
 * Turn the editor's state into what the listing endpoints accept.
 *
 * The server insists on exactly one pricing mode: a flat `price` with no
 * variants, or variants with `price` null. Sending both is a 422.
 */
export const buildListingPricingPayload = (
  pricing: ListingPricingState,
): { payload?: ListingPricingPayload; error?: string } => {
  if (pricing.mode === "single") {
    const price = Number(pricing.price);
    const error = validateListingPrice(price);
    return error
      ? { error }
      : { payload: { price, variant_label: null, variants: [] } };
  }

  const variantLabel = pricing.variantLabel.trim();
  if (!variantLabel) return { error: "Enter the question customers will see" };

  const variants = pricing.variants.map((variant, displayOrder) => ({
    ...(variant.id !== undefined ? { id: variant.id } : {}),
    name: variant.name.trim(),
    price: Number(variant.price),
    display_order: displayOrder,
  }));
  const error = validateListingVariants(variants);
  return error
    ? { error }
    : { payload: { price: null, variant_label: variantLabel, variants } };
};

/** Seed the editor from an existing listing, or blank for a new dish. */
export const listingToPricingState = (
  listing?: Pick<FoodListing, "price" | "variant_label" | "variants">,
): ListingPricingState => {
  const variants = listing ? getActiveListingVariants(listing.variants ?? []) : [];
  if (variants.length > 0) {
    return {
      mode: "variants",
      price: "",
      variantLabel: listing?.variant_label ?? "",
      variants: variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: String(variant.price),
      })),
    };
  }
  return {
    mode: "single",
    price: listing?.price != null ? String(listing.price) : "",
    variantLabel: "",
    variants: [emptyVariantField(), emptyVariantField()],
  };
};

export const getOrderListingName = (
  order: Pick<Order, "listing_title_snapshot" | "variant_name_snapshot">,
  fallbackTitle: string,
): string => {
  const title = toTitleCase(order.listing_title_snapshot || fallbackTitle);
  return order.variant_name_snapshot
    ? `${title} (${order.variant_name_snapshot})`
    : title;
};

/**
 * One order line's name, with the variant chosen on it: `Biryani (Large)`.
 *
 * Both parts are snapshotted server-side, so this reads correctly even after
 * the chef renames the dish, renames the variant or deletes the listing.
 */
export const getOrderItemName = (
  item: Pick<OrderItem, "item_title" | "variant_name">,
): string =>
  item.variant_name
    ? `${toTitleCase(item.item_title)} (${item.variant_name})`
    : toTitleCase(item.item_title);

/** A stable list key for an order line: a dish may appear once per variant. */
export const getOrderItemKey = (
  item: Pick<OrderItem, "food_listing_id" | "food_listing_variant_id">,
): string => `${item.food_listing_id}:${item.food_listing_variant_id ?? ""}`;

export const getOrderUnitPrice = (
  order: Pick<Order, "unit_price_snapshot" | "total_amount" | "quantity">,
): number =>
  order.unit_price_snapshot ?? order.total_amount / Math.max(order.quantity, 1);
