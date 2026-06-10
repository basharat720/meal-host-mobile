import { authenticatedFetch, handleApiError } from "@/lib/api";
import { API_BASE_URL } from "@/constants/config";

/**
 * Build full API URL from endpoint path
 */
export const buildUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

/**
 * Generic API request handler
 */
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = buildUrl(endpoint);

  // Ensure Content-Type is set for POST/PUT/PATCH requests with body
  const headers = new Headers(options.headers);
  if (
    (options.method === "POST" ||
      options.method === "PUT" ||
      options.method === "PATCH") &&
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    // Handle empty responses (204 No Content, etc.)
    const contentType = response.headers.get("content-type");
    if (
      response.status === 204 ||
      !contentType ||
      !contentType.includes("application/json")
    ) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

/**
 * Public API request handler (no Authorization header)
 */
export const publicApiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = buildUrl(endpoint);

  // Ensure Content-Type is set for POST/PUT/PATCH requests with body
  const headers = new Headers(options.headers);
  if (
    (options.method === "POST" ||
      options.method === "PUT" ||
      options.method === "PATCH") &&
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    // Handle empty responses (204 No Content, etc.)
    const contentType = response.headers.get("content-type");
    if (
      response.status === 204 ||
      !contentType ||
      !contentType.includes("application/json")
    ) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};
