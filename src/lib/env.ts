export const getEnv = (key: string) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    return window.__ENV__?.[key];
  }
  return process.env[key];
};

/**
 * Derives the school slug from the browser hostname at runtime.
 *
 * Production : kps.colegios.in         → "kps"
 * Staging    : kps.test.colegios.in    → "kps"  (first segment only)
 * Local dev  : kps.localhost           → "kps"
 *
 * Falls back to SCHOOL_SLUG env var only as a last resort for
 * environments that can't use a subdomain (e.g. bare IP access).
 */
export function getSchoolSlug(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname; // never includes port

    if (host.endsWith('.colegios.in')) {
      const sub = host.slice(0, host.length - '.colegios.in'.length);
      // sub may be "kps" (production) or "kps.test" (staging) — always take the first segment
      const slug = sub ? sub.split('.')[0] : '';
      if (slug) return slug;
    }

    // *.localhost resolves to 127.0.0.1 natively in modern browsers
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, host.length - '.localhost'.length);
      const slug = sub ? sub.split('.')[0] : '';
      if (slug) return slug;
    }
  }

  // Last-resort fallback (Docker / bare-IP / CI overrides)
  return getEnv('SCHOOL_SLUG') || '';
}
