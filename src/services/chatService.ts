import { API_BASE_URL } from "@/constants/config";
import { apiRequest } from "./client";

/** One message in an order's chat. */
export interface OrderMessage {
  id: number;
  order_id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface OrderThread {
  order_id: number;
  messages: OrderMessage[];
  /** False once the order has been finished for more than 24 hours. */
  can_send: boolean;
  /** "not_confirmed" before the chef accepts, "closed" after the grace period. */
  locked_reason: string | null;
  my_last_read_message_id: number | null;
  their_last_read_message_id: number | null;
  has_more: boolean;
}

export interface ChatUnread {
  total: number;
  /** Keyed by order id — JSON object keys arrive as strings. */
  by_order: Record<string, number>;
}

export const chatService = {
  getThread: (
    orderId: number,
    params: { limit?: number; beforeId?: number; afterId?: number } = {}
  ): Promise<OrderThread> => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.beforeId != null) qs.set("before_id", String(params.beforeId));
    if (params.afterId != null) qs.set("after_id", String(params.afterId));
    const query = qs.toString();
    return apiRequest<OrderThread>(
      `orders/${orderId}/messages${query ? `?${query}` : ""}`
    );
  },

  sendMessage: (orderId: number, body: string): Promise<OrderMessage> =>
    apiRequest<OrderMessage>(`orders/${orderId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  markRead: (
    orderId: number,
    lastMessageId: number
  ): Promise<{ order_id: number; last_read_message_id: number; unread_count: number }> =>
    apiRequest(`orders/${orderId}/messages/read`, {
      method: "POST",
      body: JSON.stringify({ last_message_id: lastMessageId }),
    }),

  getUnread: (): Promise<ChatUnread> => apiRequest<ChatUnread>("orders/chat/unread"),
};

/** The WebSocket URL for one order's chat, from the same base as every REST call. */
export const chatSocketUrl = (orderId: number): string =>
  `${API_BASE_URL.replace(/^http/, "ws").replace(/\/+$/, "")}/ws/orders/${orderId}/chat`;
