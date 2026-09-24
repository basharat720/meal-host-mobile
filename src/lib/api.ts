import { auth } from "@/integrations/firebase/config";

export const getAuthToken = async (forceRefresh = false): Promise<string | null> => {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(forceRefresh);
    }
    return null;
  } catch {
    return null;
  }
};

export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  let token = await getAuthToken();

  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && token) {
    token = await getAuthToken(true);
    if (!token) throw new Error("Token refresh failed. Please sign in again.");
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(url, { ...options, headers });
    if (response.status === 401) throw new Error("Authentication failed. Please sign in again.");
  }

  return response;
};

export class ApiError extends Error {
  status: number;
  /** Machine-readable reason, when the endpoint supplies one (e.g. DELIVERY_NOT_AVAILABLE). */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = "An error occurred";
  let errorCode: string | undefined;

  try {
    const errorData = await response.json();
    const detail = errorData.detail;

    // Most endpoints send `detail` as a plain string. Some send an object
    // ({ code, message }) so the client can branch on the reason without
    // matching on message text — read both shapes rather than stringifying an
    // object into the user's face.
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      errorCode = typeof detail.code === "string" ? detail.code : undefined;
      errorMessage = detail.message || detail.detail || errorMessage;
    } else if (typeof detail === "string" && detail) {
      errorMessage = detail;
    } else {
      errorMessage =
        errorData.message || errorData.error || response.statusText || `HTTP ${response.status}`;
    }
  } catch {
    errorMessage = response.statusText || `HTTP ${response.status}`;
  }

  if (typeof errorMessage !== "string") {
    errorMessage = `HTTP ${response.status}`;
  }

  // A 403 carrying its own explanation is already clear; only the bare
  // authorisation failures need the "Permission denied" prefix.
  if (response.status === 403 && !errorCode) {
    errorMessage = errorMessage.startsWith("Permission")
      ? errorMessage
      : `Permission denied: ${errorMessage}`;
  }

  throw new ApiError(errorMessage, response.status, errorCode);
};
