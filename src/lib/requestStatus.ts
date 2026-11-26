import type { FoodRequest, RequestClosedReason } from "@/services/types";
import { ApiError } from "./api";
import { getUserFriendlyError } from "./errorMessages";

/**
 * How a request's state reads to the customer who posted it. A closed request
 * says why it closed; ones closed before the reason was recorded just say
 * "Closed". Mirrors meal-host-frontend feature-docs/25.
 */
const CLOSED_LABEL: Record<RequestClosedReason, string> = {
  ACCEPTED: "Offer accepted",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
};

export const requestStatusLabel = (request: Pick<FoodRequest, "status" | "closed_reason">): string => {
  if (request.status === "OPEN") return "Open";
  return (request.closed_reason && CLOSED_LABEL[request.closed_reason]) || "Closed";
};

/**
 * What a chef whose offer was turned down is told about a closed request.
 * Null when the reason is unknown (older requests).
 */
const CHEF_CLOSED_CONTEXT: Record<RequestClosedReason, string> = {
  ACCEPTED: "Customer chose another chef",
  WITHDRAWN: "Customer withdrew this request",
  EXPIRED: "Request expired",
};

export const chefClosedContext = (reason?: RequestClosedReason | null): string | null =>
  (reason && CHEF_CLOSED_CONTEXT[reason]) || null;

const SHOWN_AS_IS = new Set([400, 403, 404, 409]);

/**
 * The server's refusal messages for a cancel or withdraw ("The 10-minute
 * cancellation window for this order has passed.") are written for the
 * customer, so those refusals are shown as-is rather than flattened.
 */
export const cancellationErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError && SHOWN_AS_IS.has(err.status) && err.message
    ? err.message
    : getUserFriendlyError(err, fallback);
