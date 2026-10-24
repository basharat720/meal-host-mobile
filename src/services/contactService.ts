import { apiRequest } from "./client";

/**
 * The contact form. Mirrors `submit` in meal-host-frontend's
 * `src/services/contactService.ts` — the admin inbox calls stay website-only.
 *
 * Works signed out: `authenticatedFetch` simply omits the Authorization
 * header when there is no token, and the backend links the message to an
 * account only if one came through.
 */

export interface ContactMessagePayload {
  first_name: string;
  last_name?: string;
  email: string;
  subject?: string;
  message: string;
}

export interface ContactMessageAccepted {
  id: number;
  created_at: string | null;
  message: string;
}

export const contactService = {
  /** Public — no account needed. */
  submit: (payload: ContactMessagePayload): Promise<ContactMessageAccepted> =>
    apiRequest<ContactMessageAccepted>("contact", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
