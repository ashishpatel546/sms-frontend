'use client';

import { useState, useEffect } from 'react';
import { fetcher } from './api';
import { getSchoolSlug } from './env';

export interface SchoolInfo {
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  logoDataUrl?: string | null;
  logoUpdatedAt?: string | null;
}

/**
 * Module-level in-memory cache shared across all hook instances within the
 * same browser tab. Keyed by school slug so it is correct when the user opens
 * multiple tabs for different school subdomains.
 *
 * A single in-flight Promise is kept so that if several components mount at
 * the same time (e.g. layout + ReceiptModal) only one HTTP request is sent.
 */
let _cache: SchoolInfo | null = null;
let _cacheKey: string | null = null;
let _inflight: Promise<SchoolInfo | null> | null = null;

/**
 * Returns the current school's public info (name, tagline, address, …).
 * Fetches once from `GET /school/info`, then serves from an in-memory cache
 * or localStorage — so subsequent callers (e.g. ReceiptModal) get the value
 * instantly with zero extra API calls.
 */
export function useSchoolInfo(): SchoolInfo | null {
  const [info, setInfo] = useState<SchoolInfo | null>(_cache);

  useEffect(() => {
    const slug = getSchoolSlug() || '';
    // v2: schema now includes `logoDataUrl`. The key bump abandons older entries
    // that may have been written with a quota-failing payload (huge base64 logo).
    const lsKey = `school_info_v2:${slug}`;
    // Always remove the legacy entry to free localStorage space, since it can be
    // hundreds of KB of base64 that we no longer persist (see below).
    try {
      localStorage.removeItem(`school_info:${slug}`);
    } catch {}

    // 1. In-memory hit — seed state immediately so there's no flicker,
    //    but still fall through to revalidate below.
    if (_cache && _cacheKey === lsKey) {
      setInfo(_cache);
    }

    // 2. localStorage hit — only the lightweight metadata is stored here
    //    (no `logoDataUrl`, which can be hundreds of KB and blow the quota).
    //    The data URL is restored from the in-memory cache or refetched.
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed: SchoolInfo = JSON.parse(raw);
        // If we have a richer in-memory cache (with logoDataUrl), prefer it.
        if (!(_cache && _cache.logoDataUrl)) {
          _cache = parsed;
          _cacheKey = lsKey;
          setInfo(parsed);
        }
      }
    } catch {
      // localStorage unavailable or corrupt — ignore.
    }

    // 3. HTTP fetch — always run (stale-while-revalidate).
    //    Deduplicated so concurrent callers share one request.
    if (!_inflight) {
      _inflight = fetcher('/school/info')
        .then((data: any) => {
          if (data?.name) {
            const result: SchoolInfo = {
              name: data.name,
              tagline: data.tagline ?? null,
              address: data.address ?? null,
              phone: data.phone ?? null,
              email: data.email ?? null,
              logoUrl: data.logoUrl ?? null,
              logoDataUrl: data.logoDataUrl ?? null,
              logoUpdatedAt: data.logoUpdatedAt ?? null,
            };
            _cache = result;
            _cacheKey = lsKey;
            // Persist WITHOUT the data URL so we never hit the quota.
            // The data URL stays in _cache for the lifetime of the tab.
            try {
              const { logoDataUrl: _drop, ...lightweight } = result;
              localStorage.setItem(lsKey, JSON.stringify(lightweight));
            } catch {}
            return result;
          }
          return null;
        })
        .catch(() => null)
        .finally(() => {
          _inflight = null;
        });
    }

    // Always update state when fresh data arrives. Use a fresh object reference
    // so React always re-renders, even if the user previously saw a stale copy.
    _inflight.then((data) => {
      if (data) setInfo({ ...data });
    });
  }, []);

  return info;
}
