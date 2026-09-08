import { apiRequest, publicApiRequest } from "./client";

/**
 * Account emails (verification, password reset).
 *
 * These are sent by our backend through Resend so they carry Pakwanhus
 * branding. Firebase still owns the flow itself — it mints and validates the
 * link — but its own email templates have a locked body, so we can't style
 * them. Do not reintroduce the firebase/auth sendEmailVerification or
 * sendPasswordResetEmail calls: those trigger the unbranded template.
 */
export const authEmailService = {
  /**
   * Re-send verification to the signed-in user. The backend reads the account
   * from the auth token, so no email address is accepted from the client.
   */
  sendEmailVerification: async (): Promise<void> => {
    await apiRequest("auth/verify-email/send", { method: "POST" });
  },

  /**
   * Request a password-reset email.
   *
   * Always resolves for any well-formed address, including ones with no
   * account — the backend deliberately doesn't reveal which exist.
   */
  requestPasswordReset: async (email: string): Promise<void> => {
    await publicApiRequest("auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};
