import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, isLocale, type Locale } from './config';
import { loadMessages } from './messages';
import { getSchoolLocale } from './school-locale';

/**
 * Language for this request: the user's own choice on this device, else the
 * school's language, else English. No locale in the URL — the subdomain is
 * already the school and the app sits behind a login.
 */
export async function resolveLocale(): Promise<Locale> {
  return (await getUserLocale()) ?? getSchoolLocale();
}

/** This person's own choice on this device, or null when following the school. */
export async function getUserLocale(): Promise<Locale | null> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(chosen) ? chosen : null;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Asia/Kolkata',
  };
});
