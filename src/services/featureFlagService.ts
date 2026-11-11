import { publicApiRequest } from "./client";

/**
 * On/off switches an admin flips from the website's admin portal, so the app
 * can change behaviour without a new build. The server enforces every flag it
 * can; the app reads them only to hide what the server would refuse anyway.
 *
 * See feature-docs/14-paying-with-payfast.md, and the `meal-host` repo's
 * feature-docs/23-feature-flags.md.
 */

export interface FeatureFlags {
  orders_enabled: boolean;
  payfast_enabled: boolean;
  /** Whether the app offers PayFast; read by the app only, never enforced by the server. */
  mobile_payfast_enabled: boolean;
  /** Offers & vouchers at checkout. See feature-docs/16-vouchers-in-the-app.md. */
  vouchers_enabled: boolean;
}

/**
 * Used while the flags load and if they can't be loaded. Server-enforced flags
 * default to on (the server refuses anything that is really off); the app's
 * PayFast switch defaults to off, so a failed load never surfaces PayFast.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  orders_enabled: true,
  payfast_enabled: true,
  mobile_payfast_enabled: false,
  // Off until the server says otherwise, so a failed load never shows offers.
  vouchers_enabled: false,
};

/** The codes the server returns (with a 503) when a request hits a switched-off feature. */
export const ORDERS_DISABLED = "ORDERS_DISABLED";
export const PAYFAST_DISABLED = "PAYFAST_DISABLED";

export const featureFlagService = {
  getFlags: (): Promise<FeatureFlags> =>
    publicApiRequest<FeatureFlags>("feature-flags"),
};
