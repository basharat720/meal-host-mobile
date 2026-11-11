import { useSyncExternalStore } from "react";
import type { CheckoutVoucher } from "@/hooks/useCheckoutVoucher";

/**
 * Hands checkout's voucher state to the Vouchers screen.
 *
 * Checkout owns the voucher (it knows the basket and delivery type) and stays
 * mounted underneath while the Vouchers screen is pushed on top. Checkout
 * publishes its live `CheckoutVoucher` here on every change; the Vouchers
 * screen reads it, so applying an offer there applies it to the checkout the
 * customer goes back to. Null when no checkout is open.
 *
 * See feature-docs/16-vouchers-in-the-app.md.
 */
let current: CheckoutVoucher | null = null;
const listeners = new Set<() => void>();

export function publishCheckoutVoucher(voucher: CheckoutVoucher | null): void {
  if (current === voucher) return;
  current = voucher;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useActiveCheckoutVoucher(): CheckoutVoucher | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
