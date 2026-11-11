import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { fillTemplate } from "@/lib/template";
import { useI18n } from "@/i18n/context";
import type { OrderItemCreate } from "@/services/types";
import { voucherService, type VoucherQuote } from "@/services/voucherService";

interface Options {
  /** False while the `vouchers_enabled` flag is off or for a request-offer order. */
  enabled: boolean;
  /** The basket, in the same line shape sent to `POST /orders`. */
  basket: OrderItemCreate[];
  /** A change re-checks the applied voucher, as the basket does. */
  deliveryType: "pickup" | "delivery";
}

export interface CheckoutVoucher {
  /** The applied voucher, priced against the current basket. One per order. */
  applied: VoucherQuote | null;
  /** The discount to take off the food price; 0 when none applies. */
  discount: number;
  offers: VoucherQuote[];
  offersLoading: boolean;
  /** The code being checked by Apply, if any. */
  applyingCode: string | null;
  /** Why the last Apply failed (the server's own message where it gave one). */
  error: string | null;
  /** Why an applied voucher was taken off. */
  notice: string | null;
  /** True while the applied voucher is being re-checked against a changed basket. */
  isRevalidating: boolean;
  apply: (code: string) => Promise<boolean>;
  remove: () => void;
  /**
   * `POST /orders` refused the voucher (409 VOUCHER_NOT_APPLICABLE): take it
   * off so the customer sees the real total before ordering again.
   */
  dropAfterOrderRefusal: (message: string) => void;
}

/**
 * The voucher state behind checkout's **Offers & vouchers** card. Everything
 * here is a preview; the server prices the voucher again when the order is
 * placed. See feature-docs/16-vouchers-in-the-app.md.
 */
export function useCheckoutVoucher({ enabled, basket, deliveryType }: Options): CheckoutVoucher {
  const { t } = useI18n();
  const [applied, setApplied] = useState<VoucherQuote | null>(null);
  const [offers, setOffers] = useState<VoucherQuote[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  // Bumped to reload the offers list after an order refusal.
  const [offersVersion, setOffersVersion] = useState(0);

  // The effects below key on the basket's contents, not its identity, and
  // read the latest basket/applied voucher through refs so that applying a
  // voucher doesn't itself trigger a re-check.
  const basketKey = JSON.stringify(basket);
  const basketRef = useRef(basket);
  basketRef.current = basket;
  const appliedRef = useRef(applied);
  appliedRef.current = applied;

  // The offers list, priced against this basket.
  useEffect(() => {
    if (!enabled || basketRef.current.length === 0) {
      setOffers([]);
      setOffersLoading(false);
      return;
    }
    let cancelled = false;
    setOffersLoading(true);
    voucherService
      .getOffers(basketRef.current)
      .then((result) => {
        if (!cancelled) setOffers(result.offers ?? []);
      })
      .catch(() => {
        // The list is a convenience; a typed code still works without it.
        if (!cancelled) setOffers([]);
      })
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, basketKey, offersVersion]);

  // Re-check the applied voucher whenever the basket or delivery type
  // changes; drop it, with the server's reason, if it no longer fits.
  useEffect(() => {
    const current = appliedRef.current;
    if (!current?.code) return;
    if (!enabled) {
      setApplied(null);
      return;
    }
    if (basketRef.current.length === 0) return;
    let cancelled = false;
    setIsRevalidating(true);
    voucherService
      .validate(current.code, basketRef.current)
      .then((quote) => {
        if (cancelled) return;
        if (quote.eligible) {
          setApplied(quote);
        } else {
          setApplied(null);
          setNotice(
            fillTemplate(t("vouchers.removedNotice"), {
              message: quote.message ?? t("vouchers.cantUse"),
            })
          );
        }
      })
      .catch(() => {
        // Keep the voucher: the server re-checks it when the order is placed
        // and refuses the order rather than charge a different amount.
      })
      .finally(() => {
        if (!cancelled) setIsRevalidating(false);
      });
    return () => {
      cancelled = true;
    };
    // `t` is left out on purpose: a language switch isn't a basket change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, basketKey, deliveryType]);

  const apply = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) {
        setError(t("vouchers.enterCode"));
        return false;
      }
      setApplyingCode(code);
      setError(null);
      setNotice(null);
      try {
        const quote = await voucherService.validate(code, basketRef.current);
        if (quote.eligible) {
          setApplied(quote);
          return true;
        }
        setError(quote.message ?? t("vouchers.cantUse"));
        return false;
      } catch (err) {
        // A 429 (20 checks a minute) carries a readable message of its own.
        setError(err instanceof ApiError && err.message ? err.message : t("vouchers.checkFailed"));
        return false;
      } finally {
        setApplyingCode(null);
      }
    },
    [t]
  );

  const remove = useCallback(() => {
    setApplied(null);
    setError(null);
    setNotice(null);
  }, []);

  const dropAfterOrderRefusal = useCallback(
    (message: string) => {
      setApplied(null);
      setError(null);
      setNotice(fillTemplate(t("vouchers.removedNotice"), { message }));
      setOffersVersion((v) => v + 1);
    },
    [t]
  );

  const discount = enabled && applied?.eligible ? applied.discount_amount : 0;

  // Memoised so the object only changes when something in it does: the
  // Vouchers screen re-renders off it (see lib/activeCheckoutVoucher.ts).
  const visibleApplied = enabled ? applied : null;
  return useMemo(
    () => ({
      applied: visibleApplied,
      discount,
      offers,
      offersLoading,
      applyingCode,
      error,
      notice,
      isRevalidating,
      apply,
      remove,
      dropAfterOrderRefusal,
    }),
    [
      visibleApplied, discount, offers, offersLoading, applyingCode, error,
      notice, isRevalidating, apply, remove, dropAfterOrderRefusal,
    ]
  );
}
