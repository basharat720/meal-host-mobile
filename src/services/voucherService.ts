import { apiRequest } from "./client";
import type { OrderItemCreate } from "./types";

/**
 * Offers and voucher codes at checkout. Both calls only *preview* a voucher
 * against the basket: the server decides the discount again when the order is
 * placed (`POST /orders` with `voucher_code`), and refuses the order with a
 * 409 VOUCHER_NOT_APPLICABLE if it no longer applies.
 *
 * See feature-docs/16-vouchers-in-the-app.md, and the `meal-host` repo's
 * feature-docs/27-vouchers.md.
 */

/** Why a voucher can't be used. `message` carries the customer-facing words. */
export type VoucherReasonCode =
  | "VOUCHERS_DISABLED"
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "WRONG_DAY"
  | "WRONG_TIME"
  | "USAGE_LIMIT_REACHED"
  | "ALREADY_USED"
  | "REQUEST_ORDER_NOT_ALLOWED"
  | "NO_ELIGIBLE_ITEMS"
  | "MIN_ORDER_NOT_MET";

/** The code inside the 409 `detail` when an order's voucher no longer applies. */
export const VOUCHER_NOT_APPLICABLE = "VOUCHER_NOT_APPLICABLE";

/** A basket line the voucher covers, with its share of the discount. */
export interface VoucherLineRef {
  food_listing_id: number;
  food_listing_variant_id?: number | null;
  discount_amount: number;
}

/** A voucher priced against one basket. */
export interface VoucherQuote {
  code?: string | null;
  title?: string | null;
  description?: string | null;
  /** One-line rule written by the server, worded the same on every client. */
  summary?: string | null;
  discount_type?: "PERCENT" | "FLAT" | null;
  discount_value?: number | null;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  eligible: boolean;
  discount_amount: number;
  eligible_subtotal: number;
  /** Empty unless `eligible`. */
  eligible_items: VoucherLineRef[];
  reason_code?: VoucherReasonCode | string | null;
  message?: string | null;
}

export interface VoucherOffers {
  offers: VoucherQuote[];
}

export const voucherService = {
  /**
   * Public offers running now, each priced against the basket — usable ones
   * first. Empty while the `vouchers_enabled` flag is off.
   */
  getOffers: (items: OrderItemCreate[]): Promise<VoucherOffers> =>
    apiRequest<VoucherOffers>("vouchers/offers", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  /** Check a typed code against the basket. Always 200; `eligible` says whether it applies. */
  validate: (code: string, items: OrderItemCreate[]): Promise<VoucherQuote> =>
    apiRequest<VoucherQuote>("vouchers/validate", {
      method: "POST",
      body: JSON.stringify({ code, items }),
    }),
};

/** Whether a voucher's `eligible_items` covers this basket line. */
export const isLineCoveredByVoucher = (
  quote: VoucherQuote | null | undefined,
  foodListingId: number,
  variantId?: number | null
): boolean =>
  !!quote?.eligible &&
  quote.eligible_items.some(
    (line) =>
      line.food_listing_id === foodListingId &&
      (line.food_listing_variant_id ?? null) === (variantId ?? null)
  );
