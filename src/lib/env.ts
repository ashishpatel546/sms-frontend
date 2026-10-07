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
    const slug = slugFromHost(window.location.hostname);
    if (slug) return slug;
  }

  // Last-resort fallback (Docker / bare-IP / CI overrides)
  return getEnv('SCHOOL_SLUG') || '';
}

/**
 * The slug part of a hostname, or '' when it carries none. Shared by
 * getSchoolSlug() (browser) and the server, which reads the Host header.
 */
export function slugFromHost(hostname: string): string {
  const host = hostname.split(':')[0].toLowerCase(); // Host headers carry the port

  if (host.endsWith('.colegios.in')) {
    const sub = host.slice(0, host.length - '.colegios.in'.length);
    // sub may be "kps" (production) or "kps.test" (staging) — always take the first segment
    return sub ? sub.split('.')[0] : '';
  }

  // *.localhost resolves to 127.0.0.1 natively in modern browsers
  if (host.endsWith('.localhost')) {
    const sub = host.slice(0, host.length - '.localhost'.length);
    return sub ? sub.split('.')[0] : '';
  }

  // Cloudflare tunnel: edusphere.appme.in → "edusphere"
  if (host.endsWith('.appme.in')) {
    const sub = host.slice(0, host.length - '.appme.in'.length);
    const slug = sub ? sub.split('.')[0] : '';
    const reserved = ['myapp', 'myrealapp'];
    return slug && !reserved.includes(slug) ? slug : '';
  }

  return '';
}
