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
    const lsKey = `school_info:${slug}`;

    // 1. In-memory hit — seed state immediately so there's no flicker,
    //    but still fall through to revalidate below.
    if (_cache && _cacheKey === lsKey) {
      setInfo(_cache);
    }

    // 2. localStorage hit (persists across page refreshes) — serve immediately,
    //    but always revalidate in background so logo changes are picked up.
    let servedFromCache = false;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed: SchoolInfo = JSON.parse(raw);
        _cache = parsed;
        _cacheKey = lsKey;
        setInfo(parsed);
        servedFromCache = true;
      }
    } catch {
      // localStorage unavailable (e.g. private mode with storage blocked)
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
              logoUpdatedAt: data.logoUpdatedAt ?? null,
            };
            _cache = result;
            _cacheKey = lsKey;
            try {
              localStorage.setItem(lsKey, JSON.stringify(result));
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

    // Always update state when fresh data arrives
    _inflight.then((data) => {
      if (data) setInfo(data);
    });
  }, []);

  return info;
}
