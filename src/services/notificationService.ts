import { apiRequest } from "./client";

export interface AppNotification {
  id: number;
  title: string;
  body?: string;
  url?: string;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  getAll: (): Promise<AppNotification[]> =>
    apiRequest<AppNotification[]>("notifications/"),

  getUnreadCount: (): Promise<{ count: number }> =>
    apiRequest<{ count: number }>("notifications/unread-count"),

  markRead: (id: number): Promise<AppNotification> =>
    apiRequest<AppNotification>(`notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: (): Promise<void> =>
    apiRequest<void>("notifications/read-all", { method: "POST" }),
};
