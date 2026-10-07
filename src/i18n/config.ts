/**
 * Languages the portal is translated into.
 *
 * Adding one: create messages/<code>/ (tsc fails until every key in
 * messages/en/ is translated), add the code here and in sms-backend's
 * SCHOOL_LANGUAGES + its CHECK constraint, and add its font in app/layout.tsx.
 */
export const LOCALES = ['en', 'hi', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when the school has no language set or it cannot be fetched. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * A user's own choice for this device. When absent, the portal follows the
 * school's language. Cookies are per host, so per school.
 */
export const LOCALE_COOKIE = 'sms_locale';

/**
 * BCP-47 tags for Intl formatters. Digits stay Latin in every language:
 * marks, fees and phone numbers are typed in Latin digits, and bn-IN would
 * otherwise print ১২৩ beside them (hi-IN already defaults to Latin).
 */
export const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN-u-nu-latn',
};

/** Each language named in itself — what the switcher shows. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
