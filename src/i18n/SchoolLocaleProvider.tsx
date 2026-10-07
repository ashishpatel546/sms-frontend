"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";

type LocalePrefs = {
    /** The school's language. */
    school: Locale;
    /** This person's own choice on this device, or null when following the school. */
    user: Locale | null;
};

/**
 * Both language preferences as the server resolved them for this render, so
 * the language picker and Settings show current values after a
 * router.refresh() — useSchoolInfo's module cache would not update.
 */
const LocalePrefsContext = createContext<LocalePrefs>({ school: DEFAULT_LOCALE, user: null });

export function SchoolLocaleProvider({ value, children }: { value: LocalePrefs; children: ReactNode }) {
    return <LocalePrefsContext.Provider value={value}>{children}</LocalePrefsContext.Provider>;
}

export function useSchoolLocale(): Locale {
    return useContext(LocalePrefsContext).school;
}

export function useUserLocale(): Locale | null {
    return useContext(LocalePrefsContext).user;
}
