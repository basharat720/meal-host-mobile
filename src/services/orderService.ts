import { apiRequest } from "./client";
import { Order, OrderCreate, OrderUpdate, PaymentBase, PaymentIntentOut, PaginatedResponse } from "./types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const sanitizePagination = (skip = 0, limit = DEFAULT_PAGE_SIZE) => ({
  skip: Math.max(0, Math.floor(skip)),
  limit: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit))),
});

const buildOrdersQuery = (params: {
  customerId?: number;
  chefId?: number;
  skip?: number;
  limit?: number;
  status?: Order["status"];
}) => {
  const { skip, limit } = sanitizePagination(params.skip, params.limit);
  const qs = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });

  if (params.customerId != null) qs.set("customer_id", String(params.customerId));
  if (params.chefId != null) qs.set("chef_id", String(params.chefId));
  if (params.status) qs.set("status", params.status);

  return `orders/?${qs.toString()}`;
};

export interface PaymentRecord {
  id: number;
  order_id: number;
  method: string;
  status: string;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
}

export const orderService = {
  createOrder: async (orderData: OrderCreate): Promise<Order> => {
    return apiRequest<Order>("orders/", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  },

  getChefOrders: async (
    chefLocalUserId: number,
    skip = 0,
    limit = DEFAULT_PAGE_SIZE,
    status?: Order["status"]
  ): Promise<PaginatedResponse<Order>> => {
    if (!Number.isInteger(chefLocalUserId) || chefLocalUserId <= 0) {
      throw new Error("chefLocalUserId must be a positive integer");
    }

    return apiRequest<PaginatedResponse<Order>>(
      buildOrdersQuery({ chefId: chefLocalUserId, skip, limit, status })
    );
  },

  getCustomerOrders: async (
    customerLocalUserId: number,
    skip = 0,
    limit = DEFAULT_PAGE_SIZE,
    status?: Order["status"]
  ): Promise<PaginatedResponse<Order>> => {
    if (!Number.isInteger(customerLocalUserId) || customerLocalUserId <= 0) {
      throw new Error("customerLocalUserId must be a positive integer");
    }

    return apiRequest<PaginatedResponse<Order>>(
      buildOrdersQuery({ customerId: customerLocalUserId, skip, limit, status })
    );
  },

  updateOrderStatus: async (
    orderId: number,
    status: OrderUpdate["status"],
    confirmedEtaMinutes?: number
  ): Promise<Order> => {
    const body: OrderUpdate = { status };
    if (confirmedEtaMinutes !== undefined) {
      body.confirmed_eta_minutes = confirmedEtaMinutes;
    }
    return apiRequest<Order>(`orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  payOrder: async (orderId: number, paymentData: PaymentBase): Promise<PaymentRecord | PaymentIntentOut> => {
    return apiRequest<PaymentRecord | PaymentIntentOut>(`orders/${orderId}/pay`, {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  },

  initiateStripePayment: async (orderId: number): Promise<PaymentIntentOut> => {
    return apiRequest<PaymentIntentOut>(`orders/${orderId}/pay`, {
      method: "POST",
      body: JSON.stringify({ method: "STRIPE" }),
    });
  },

  confirmPayment: async (
    orderId: number,
    paymentIntentId: string
  ): Promise<PaymentRecord> => {
    return apiRequest<PaymentRecord>(
      `orders/${orderId}/confirm-payment`,
      {
        method: "POST",
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      }
    );
  },
};
