import { UserRegisterRequest, UserUpdate } from "./types";

/**
 * Normalises the chef profile before it goes over the wire.
 *
 * The backend PATCH applies every key it receives, so a key that is present
 * but empty is a deliberate "clear this field" instruction. This helper must
 * therefore never invent keys the caller did not set — doing so used to blank
 * `specialties` / `dietary_tags` / `documents` whenever a screen saved a single
 * chef field (e.g. the dashboard's default prep time), silently wiping the
 * chef's specialties, cuisine types and food-safety documents.
 *
 * Keys the caller *did* set are kept as-is, with `null`/`undefined` array
 * values coerced to `[]` so the backend never sees a null for a list column.
 */
export const normalizeUserPayload = <T extends UserRegisterRequest | UserUpdate>(
  userData: T,
): T => {
  if (!userData.chef_profile) return userData;

  const chefProfile = { ...userData.chef_profile };

  for (const key of ["specialties", "dietary_tags", "documents"] as const) {
    if (key in chefProfile && chefProfile[key] == null) {
      chefProfile[key] = [];
    }
  }

  return { ...userData, chef_profile: chefProfile };
};
