import { UserRegisterRequest, UserUpdate } from "./types";

export const normalizeUserPayload = <T extends UserRegisterRequest | UserUpdate>(
  userData: T,
): T => {
  if (!userData.chef_profile) return userData;

  return {
    ...userData,
    chef_profile: {
      ...userData.chef_profile,
      specialties: userData.chef_profile.specialties ?? [],
      dietary_tags: userData.chef_profile.dietary_tags ?? [],
      documents: userData.chef_profile.documents ?? [],
    },
  };
};
