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
 * Production : edusphere.colegios.in  → "edusphere"
 * Local dev  : edusphere.localhost    → "edusphere"
 *              (access the app at http://edusphere.localhost:3000)
 *
 * Falls back to SCHOOL_SLUG env var only as a last resort for
 * environments that can't use a subdomain (e.g. bare IP access).
 */
export function getSchoolSlug(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname; // never includes port

    if (host.endsWith('.colegios.in')) {
      const sub = host.slice(0, host.length - '.colegios.in'.length);
      if (sub && !sub.includes('.')) return sub;
    }

    // *.localhost resolves to 127.0.0.1 natively in modern browsers
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, host.length - '.localhost'.length);
      if (sub && !sub.includes('.')) return sub;
    }
  }

  // Last-resort fallback (Docker / bare-IP / CI overrides)
  return getEnv('SCHOOL_SLUG') || '';
}
