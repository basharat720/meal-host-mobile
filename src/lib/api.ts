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
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = "An error occurred";
  try {
    const errorData = await response.json();
    errorMessage = errorData.detail || errorData.message || errorData.error || response.statusText || `HTTP ${response.status}`;
  } catch {
    errorMessage = response.statusText || `HTTP ${response.status}`;
  }
  if (response.status === 403) {
    errorMessage = errorMessage.startsWith("Permission") ? errorMessage : `Permission denied: ${errorMessage}`;
  }
  throw new ApiError(errorMessage, response.status);
};
