import { User } from "@/services/types";

/**
 * Shared chef-status helpers, mirroring the web ChefDashboard logic.
 *
 * The backend User payload carries an `email_verified` flag that the mobile
 * `User` type does not (yet) declare, so we widen the parameter inline rather
 * than redefining the shared type. Activation currently depends solely on the
 * user + chef profile status being "active".
 */
type DbUserLike = (User & { email_verified?: boolean }) | null | undefined;

/**
 * Whether the chef account is fully active and allowed to add menu items /
 * accept orders. Mirrors the web check: both the user status and the chef
 * profile status must be "active".
 */
export function isChefActive(dbUser: DbUserLike): boolean {
  return dbUser?.status === "active" && dbUser?.chef_profile?.status === "active";
}

/**
 * Human-readable list of reasons a chef account is not yet active, matching
 * the web activation-blockers messaging. Empty when nothing is blocking (the
 * account is either active or pending backend approval).
 */
export function getActivationBlockers(dbUser: DbUserLike): string[] {
  const blockers: string[] = [];
  if (dbUser?.email_verified === false) {
    blockers.push("Verify your email address");
  }
  return blockers;
}
