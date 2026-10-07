import type { Messages } from "./messages/en";

/**
 * A translatable message from a non-component helper in src/lib: the key under
 * `common.helper` plus its values. Helpers return this instead of English so
 * screens can show it with `useTranslations("common.helper")`:
 *
 *   const th = useTranslations("common.helper");
 *   const m = fixErrorMessage(err);
 *   th(m.key, m.values)
 */
export type HelperKey = keyof Messages["common"]["helper"];
export type HelperMessage = { key: HelperKey; values?: Record<string, string | number> };
