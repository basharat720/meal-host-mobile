import type { Order } from "@/services/types";

/**
 * The one place an order status becomes a colour.
 *
 * Mirrors `getStatusColor` in meal-host-frontend's
 * `src/pages/CustomerOrdersPage.tsx`, so an order never changes colour between
 * the app and the website. The tones themselves are `colors.status.*` in
 * `@/constants/theme`, which mirror the web's `--status-*` variables.
 *
 * Before this existed the customer and chef order screens carried their own
 * maps and disagreed: a CONFIRMED order read as outline to a customer and grey
 * to the chef, and DELIVERED read grey to one and green to the other.
 */
export type StatusTone = "pending" | "active" | "ready" | "done" | "closed" | "cancelled";

export const ORDER_STATUS_TONE: Record<Order["status"], StatusTone> = {
  PENDING: "pending",
  CONFIRMED: "active",
  READY_FOR_PICKUP: "ready",
  DELIVERED: "ready",
  RECEIVED: "done",
  COMPLETED: "closed",
  CANCELLED: "cancelled",
};

/**
 * Accepts a plain string because the earnings endpoint types its order status
 * loosely. An unrecognised status falls back to the neutral "closed" tone
 * rather than throwing or rendering an uncoloured badge.
 */
export const orderStatusTone = (status: Order["status"] | string): StatusTone =>
  ORDER_STATUS_TONE[status as Order["status"]] ?? "closed";
