import { toTitleCase } from "@/lib/titleCase";

/**
 * The shape any chef-ish record needs for a display name to be resolved.
 *
 * Typed on just the fields that are read, rather than on Chef/User, so the
 * narrower ChefListItem returned by the chefs endpoint fits too.
 */
interface NameableChef {
  name?: string;
  kitchen_name?: string | null;
  chef_profile?: { kitchen_name?: string | null } | null;
}

/**
 * The name shown to customers and on the chef's own portal.
 *
 * Kitchen name is mandatory at signup, but chefs created before the field
 * existed (or any record where it was left blank) fall back to the chef's own
 * name — the same rule the backend applies.
 */
export const chefDisplayName = (
  chef?: NameableChef | null,
  fallback = "Home Kitchen"
): string => {
  if (!chef) return fallback;
  const kitchenName = chef.kitchen_name ?? chef.chef_profile?.kitchen_name;
  return toTitleCase(kitchenName?.trim() || chef.name?.trim()) || fallback;
};
