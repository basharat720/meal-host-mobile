/**
 * Turns technical errors into something worth showing a user, while the full
 * error still goes to the console for debugging.
 *
 * Ported from the web app's src/lib/errorMessages.ts, with the Firebase
 * auth-code handling that web keeps inline in AuthForm.tsx folded in — mobile
 * has four auth screens rather than one shared form, so it needs to be
 * reusable here.
 */

import { ApiError } from "./api";
import { DELIVERY_NOT_AVAILABLE } from "@/services/serviceAreaService";

/** Firebase surfaces these as `Firebase: Error (auth/wrong-password).` */
const FIREBASE_AUTH_MESSAGES: { codes: string[]; message: string }[] = [
  {
    codes: ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"],
    message: "Invalid email or password. Please try again.",
  },
  {
    codes: ["auth/too-many-requests"],
    message: "Too many failed attempts. Please try again later.",
  },
  {
    codes: ["auth/email-already-in-use"],
    message: "This email is already registered. Please sign in instead.",
  },
  {
    codes: ["auth/weak-password"],
    message: "Password is too weak. Please choose a stronger one.",
  },
  {
    codes: ["auth/invalid-email"],
    message: "That doesn't look like a valid email address.",
  },
  {
    codes: ["auth/user-disabled"],
    message: "This account has been disabled. Please contact support.",
  },
  {
    codes: ["auth/network-request-failed"],
    message: "Unable to connect. Please check your internet connection and try again.",
  },
  {
    codes: ["auth/requires-recent-login"],
    message: "Please sign in again to continue.",
  },
];

/**
 * Map a Firebase auth error to readable copy, or null when it isn't one.
 * Exported so a screen can special-case a code before falling back.
 */
export function getFirebaseAuthError(error: unknown): string | null {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!raw.includes("auth/")) return null;

  for (const entry of FIREBASE_AUTH_MESSAGES) {
    if (entry.codes.some((code) => raw.includes(code))) return entry.message;
  }

  // An auth/* code we haven't mapped. Its raw form is meaningless to a user.
  return "Sign-in failed. Please try again.";
}

/**
 * Convert any error to a user-facing message. The full error is logged.
 */
export function getUserFriendlyError(error: unknown, fallbackMessage?: string): string {
  console.error("[Error Details for Debugging]:", error);

  const firebaseMessage = getFirebaseAuthError(error);
  if (firebaseMessage) return firebaseMessage;

  let errorMessage = "";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object" && "message" in error) {
    errorMessage = String((error as { message: unknown }).message);
  }

  const lowerError = errorMessage.toLowerCase();

  if (
    lowerError.includes("network") ||
    lowerError.includes("fetch") ||
    lowerError.includes("connection")
  ) {
    return "Unable to connect. Please check your internet connection and try again.";
  }

  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return "The request took too long. Please try again.";
  }

  if (
    lowerError.includes("unauthorized") ||
    lowerError.includes("authentication") ||
    lowerError.includes("401")
  ) {
    return "Please sign in to continue.";
  }

  if (
    lowerError.includes("forbidden") ||
    lowerError.includes("permission") ||
    lowerError.includes("403")
  ) {
    return "You don't have permission to do that.";
  }

  if (lowerError.includes("not found") || lowerError.includes("404")) {
    return fallbackMessage || "The requested item was not found.";
  }

  if (
    lowerError.includes("500") ||
    lowerError.includes("502") ||
    lowerError.includes("503") ||
    lowerError.includes("server error") ||
    lowerError.includes("internal error")
  ) {
    return "Something went wrong on our end. Please try again later.";
  }

  if (lowerError.includes("invalid") || lowerError.includes("validation")) {
    // Already readable — pass it through rather than flattening it.
    if (
      errorMessage.length < 100 &&
      !lowerError.includes("exception") &&
      !lowerError.includes("error:")
    ) {
      return errorMessage;
    }
    return "Please check your input and try again.";
  }

  // Stack traces and very long messages are never worth showing.
  if (
    errorMessage.includes("Error:") ||
    errorMessage.includes("Exception") ||
    errorMessage.includes("at ") ||
    errorMessage.length > 150
  ) {
    return fallbackMessage || "Something went wrong. Please try again.";
  }

  if (errorMessage && errorMessage.length < 100) return errorMessage;

  return fallbackMessage || "An unexpected error occurred. Please try again.";
}

export const getProfileError = (error: unknown): string =>
  getUserFriendlyError(error, "Unable to update profile. Please try again.");

export const getUploadError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  if (raw.includes("size")) return "That image is too large. Please choose a smaller one.";
  if (raw.includes("type")) return "Unsupported image type. Please use JPG, PNG or WebP.";
  return getUserFriendlyError(error, "Upload failed. Please try again.");
};

export const getCheckoutError = (error: unknown): string => {
  // The delivery-zone refusal carries a code precisely so it doesn't have to be
  // matched on message text, and its message already names pickup as the way
  // forward. See feature-docs/07-ordering-zone-in-the-app.md.
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === DELIVERY_NOT_AVAILABLE) {
    return (
      (error as ApiError).message ||
      "We can't deliver this order. You can still place it for pickup."
    );
  }
  return getUserFriendlyError(error, "Unable to place your order. Please try again.");
};

export const getRequestError = (error: unknown): string =>
  getUserFriendlyError(error, "Unable to load request details. Please try again.");
