import { apiRequest } from "./client";
import { User, UserRegisterRequest, UserUpdate } from "./types";
import { normalizeUserPayload } from "./userPayload";

export { normalizeUserPayload } from "./userPayload";

export const userService = {
  /**
   * Get current user profile
   */
  getUser: async (): Promise<User> => {
    return apiRequest<User>("users/me");
  },

  /**
   * Get user profile by ID
   */
  getUserById: async (id: string): Promise<User> => {
    return apiRequest<User>(`users/${id}`);
  },

  /**
   * Create a new user (Customer or Chef)
   */
  createUser: async (userData: UserRegisterRequest): Promise<User> => {
    const payload = normalizeUserPayload(userData);
    return apiRequest<User>("users/", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  /**
   * Update user profile
   */
  updateUser: async (
    userId: number | string,
    userData: UserUpdate
  ): Promise<User> => {
    const payload = normalizeUserPayload(userData);
    const { firebase_uid: _ignoredFirebaseUid, ...safePayload } = payload as UserUpdate & {
      firebase_uid?: string;
    };

    return apiRequest<User>(`users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(safePayload)
    });
  },

  /**
   * Permanently delete the signed-in user's own account.
   *
   * Irreversible. The server anonymises the account, removes saved addresses
   * and favorites, takes a chef's kitchen off the marketplace and destroys the
   * Firebase identity, so the current session stops working the moment this
   * resolves. Rejects with the server's message when an order is still in
   * flight (409). See feature-docs/10-deleting-your-account.md.
   */
  deleteAccount: async (): Promise<void> => {
    return apiRequest<void>("users/me", {
      method: "DELETE"
    });
  },

  saveFcmToken: (userId: number, token: string): Promise<void> =>
    apiRequest<void>(`users/${userId}/fcm-token`, {
      method: "PUT",
      body: JSON.stringify({ fcm_token: token }),
    }),
};
