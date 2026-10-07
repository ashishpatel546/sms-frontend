import 'server-only';
import { headers } from 'next/headers';
import { slugFromHost } from '@/lib/env';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

/**
 * The school's portal language, looked up per request on the server so the
 * very first paint is already in it (no English flash, then a switch).
 *
 * Cached per slug in this process. PM2 runs this app as one fork-mode
 * instance, so clearSchoolLocaleCache() after a save reaches every request.
 * The TTL only bounds how stale a change made elsewhere (the hub, another
 * frontend) can be.
 */
const TTL_MS = 60_000;
const TIMEOUT_MS = 1_500;
const cache = new Map<string, { locale: Locale; expiresAt: number }>();

export async function currentSlug(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  return slugFromHost(host) || process.env.SCHOOL_SLUG || '';
}

export async function getSchoolLocale(): Promise<Locale> {
  const slug = await currentSlug();
  if (!slug) return DEFAULT_LOCALE;

  const hit = cache.get(slug);
  if (hit && hit.expiresAt > Date.now()) return hit.locale;

  const api = process.env.API_URL;
  if (!api) return DEFAULT_LOCALE;

  let locale: Locale = hit?.locale ?? DEFAULT_LOCALE;
  try {
    const res = await fetch(`${api}/school/language`, {
      headers: { 'X-School-Slug': slug },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const body: { defaultLanguage?: unknown } = await res.json();
      if (isLocale(body.defaultLanguage)) locale = body.defaultLanguage;
    }
  } catch {
    // Backend slow or down: keep the last known language (or English) rather
    // than hold up every page. Cached below so we do not retry per request.
  }
  cache.set(slug, { locale, expiresAt: Date.now() + TTL_MS });
  return locale;
}

export function clearSchoolLocaleCache(slug: string) {
  cache.delete(slug);
}
