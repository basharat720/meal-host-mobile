const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Upload a local image to Cloudinary (unsigned) and return the CDN URL.
 *
 * Requires an unsigned upload preset:
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=<your-cloud-name>
 *   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<your-unsigned-preset>
 *
 * @param uri        Local file uri from the image picker.
 * @param folder     Cloudinary folder to file it under.
 * @param baseName   Filename stem sent with the upload.
 */
const upload = async (uri: string, folder: string, baseName: string): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = MIME_BY_EXTENSION[extension] ?? "image/jpeg";

  const formData = new FormData();
  // React Native's FormData takes this {uri,name,type} shape rather than a
  // File/Blob, which its types don't describe — hence the cast.
  formData.append("file", {
    uri,
    name: `${baseName}.${extension}`,
    type: mimeType,
  } as unknown as Blob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Cloudinary upload failed (${response.status}): ${error?.error?.message ?? ""}`
    );
  }

  const data = await response.json();
  const url = data.secure_url || data.url;
  if (!url) throw new Error("Cloudinary response missing URL");
  return url as string;
};

/** Cloudinary folders are path segments, so anything unusual is stripped. */
const safeSegment = (value: string, fallback: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "_") || fallback;

/** A chef's or customer's profile picture. */
export const uploadProfilePicture = (uri: string, uploaderId: string): Promise<string> =>
  upload(uri, `profile-pictures/${safeSegment(uploaderId, "signup-user")}`, "profile");

/** A photo for one of a chef's dishes. */
export const uploadFoodImage = (uri: string, chefUid: string): Promise<string> =>
  upload(uri, `food-images/${safeSegment(chefUid, "chef")}`, "food");
