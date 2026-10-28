import { authenticatedFetch, handleApiError } from "@/lib/api";
import { buildUrl } from "./client";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

type ImagePurpose = "profile_picture" | "dish";

/**
 * Upload a local image through the backend (POST /uploads/images), which
 * stores it in Firebase Storage as WebP and returns its URL. Needs a
 * signed-in Firebase user; the backend picks the folder from their uid.
 *
 * See meal-host feature-docs/22-image-uploads.md.
 *
 * @param uri      Local file uri from the image picker.
 * @param purpose  Decides the folder and quality on the backend.
 */
const upload = async (uri: string, purpose: ImagePurpose): Promise<string> => {
  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = MIME_BY_EXTENSION[extension] ?? "image/jpeg";

  const formData = new FormData();
  // React Native's FormData takes this {uri,name,type} shape rather than a
  // File/Blob, which its types don't describe — hence the cast.
  formData.append("file", {
    uri,
    name: `${purpose}.${extension}`,
    type: mimeType,
  } as unknown as Blob);
  formData.append("purpose", purpose);

  // Not apiRequest: it would force a JSON Content-Type over the multipart one
  // fetch sets for FormData.
  const response = await authenticatedFetch(buildUrl("/uploads/images"), {
    method: "POST",
    body: formData,
  });
  if (!response.ok) await handleApiError(response);

  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("Upload did not return an image URL");
  return url;
};

/** A chef's or customer's profile picture. */
export const uploadProfilePicture = (uri: string): Promise<string> =>
  upload(uri, "profile_picture");

/** A photo for one of a chef's dishes. */
export const uploadFoodImage = (uri: string): Promise<string> => upload(uri, "dish");
