'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale } from './config';
import { clearSchoolLocaleCache, currentSlug } from './school-locale';

/**
 * Remember a user's own language on this device, or pass null to go back to
 * following the school's language. The caller refreshes the router.
 */
export async function setUserLocale(locale: string | null) {
  const jar = await cookies();
  if (locale === null) {
    jar.delete(LOCALE_COOKIE);
    return;
  }
  if (!isLocale(locale)) return;
  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}

/**
 * Called after Settings saves the school's language. Drops this server's
 * cached copy so the next render reads the saved value from the backend.
 * Takes no language on purpose: a server action is a public endpoint, and
 * the backend is the only authority on what the school chose.
 */
export async function refreshSchoolLocale() {
  const slug = await currentSlug();
  if (slug) clearSchoolLocaleCache(slug);
}
