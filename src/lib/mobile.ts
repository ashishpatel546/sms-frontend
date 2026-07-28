/**
 * Mobile numbers double as the login identifier for staff and parents, and
 * login matches the stored value exactly. A number saved as "9716 160389"
 * therefore looks fine in the UI but can never log in — the user just sees
 * "invalid credentials". Keep these rules in sync with the backend's
 * `src/common/utils/mobile.util.ts`.
 */
export const MOBILE_ERROR = "Enter a valid 10-digit mobile number";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Drops formatting and the +91 / leading-0 prefixes users often paste in. */
export function normalizeMobile(value: string): string {
  const compact = (value ?? "").replace(/[\s\-().]/g, "");
  return compact.replace(/^(?:\+?91|0)(?=\d{10}$)/, "");
}

/**
 * For input `onChange` — keeps the field to digits only so a stray space or a
 * pasted "+91 97161 60389" can never reach the form state in the first place.
 */
export function formatMobileInput(value: string): string {
  return normalizeMobile(value).replace(/\D/g, "").slice(0, 10);
}

export function isValidMobile(value: string): boolean {
  return MOBILE_REGEX.test(value ?? "");
}
