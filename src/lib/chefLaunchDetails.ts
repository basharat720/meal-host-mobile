/**
 * Chef launch checklist: bank account and NTN status rules.
 *
 * Mirrors the backend's ChefLaunchDetails schema so a bad value is caught on
 * the form instead of coming back as a 422. See
 * feature-docs/11-chef-launch-details.md (mirrors the web app's lib/chefLaunchDetails.ts).
 */

export type NtnStatus = "filer" | "non_filer";

export interface LaunchDetailsFields {
  bankName: string;
  bankAccountTitle: string;
  bankAccountNumber: string;
  bankIban: string;
  ntnStatus: NtnStatus | "";
}

const PK_IBAN_RE = /^PK\d{2}[A-Z]{4}[0-9A-Z]{16}$/;

export const normalizeAccountNumber = (value: string): string =>
  value.replace(/[\s-]/g, "");

export const normalizeIban = (value: string): string =>
  value.replace(/\s/g, "").toUpperCase();

/** ISO 13616 mod-97 check, done piecewise so it never overflows a JS number. */
const ibanChecksumOk = (iban: string): boolean => {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = parseInt(ch, 36).toString();
    for (const d of digits) {
      remainder = (remainder * 10 + Number(d)) % 97;
    }
  }
  return remainder === 1;
};

export const isValidPkIban = (value: string): boolean => {
  const iban = normalizeIban(value);
  return PK_IBAN_RE.test(iban) && ibanChecksumOk(iban);
};

/**
 * Every field is required on the profile form. Returns an error message per
 * invalid field, keyed by the field name; an empty object means valid.
 */
export const validateLaunchDetails = (
  fields: LaunchDetailsFields,
): Partial<Record<keyof LaunchDetailsFields, string>> => {
  const errors: Partial<Record<keyof LaunchDetailsFields, string>> = {};

  const bankName = fields.bankName.trim();
  if (!bankName) errors.bankName = "Bank name is required";
  else if (bankName.length > 100) errors.bankName = "Bank name is too long";

  const title = fields.bankAccountTitle.trim();
  if (!title) errors.bankAccountTitle = "Account title is required";
  else if (title.length > 100) errors.bankAccountTitle = "Account title is too long";

  const accountNumber = normalizeAccountNumber(fields.bankAccountNumber);
  if (!accountNumber) errors.bankAccountNumber = "Account number is required";
  else if (!/^\d{8,20}$/.test(accountNumber))
    errors.bankAccountNumber = "Account number must be 8-20 digits";

  if (!fields.bankIban.trim()) errors.bankIban = "IBAN is required";
  else if (!isValidPkIban(fields.bankIban))
    errors.bankIban = "Enter a valid Pakistani IBAN (24 characters starting with PK)";

  if (!fields.ntnStatus) errors.ntnStatus = "Select filer or non-filer";

  return errors;
};
