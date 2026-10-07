/**
 * Latin digits for Bengali everywhere.
 *
 * Digits stay Latin in every language (see INTL_LOCALE in config.ts), but
 * next-intl formats plural `#`, `{n, number}` and `{d, date}` with
 * `new Intl.NumberFormat("bn")`, which prints ১২৩, and messages cannot set a
 * numbering system. So, for Bengali locales only, Intl.NumberFormat and
 * Intl.DateTimeFormat default to `numberingSystem: "latn"` unless the caller
 * or the locale tag (`-u-nu-…`) already chose one. Imported once on the server
 * (i18n/request.ts) and once in the browser (SchoolLocaleProvider).
 */

type Locales = string | readonly string[] | undefined;

function wantsLatin(locales: Locales, options: { numberingSystem?: string } | undefined): boolean {
  if (options?.numberingSystem) return false;
  const first = Array.isArray(locales) ? locales[0] : locales;
  return typeof first === "string" && /^bn(-|$)/i.test(first) && !/-u-(?:.*-)?nu-/i.test(first);
}

function patch<K extends "NumberFormat" | "DateTimeFormat">(name: K) {
  const Native = Intl[name] as unknown as {
    new (locales?: Locales, options?: object): object;
    prototype: object;
    supportedLocalesOf: (locales: Locales, options?: object) => string[];
  } & { __latinDigits?: true };
  if (Native.__latinDigits) return;

  // A plain function (not a class) so `Intl.NumberFormat(...)` without `new`
  // keeps working; sharing the prototype keeps `instanceof` true.
  function Wrapped(locales?: Locales, options?: { numberingSystem?: string }) {
    return new Native(locales, wantsLatin(locales, options) ? { ...options, numberingSystem: "latn" } : options);
  }
  Wrapped.prototype = Native.prototype;
  Wrapped.supportedLocalesOf = Native.supportedLocalesOf.bind(Native);
  (Wrapped as unknown as { __latinDigits: true }).__latinDigits = true;
  (Intl as unknown as Record<string, unknown>)[name] = Wrapped;
}

patch("NumberFormat");
patch("DateTimeFormat");

export {};
