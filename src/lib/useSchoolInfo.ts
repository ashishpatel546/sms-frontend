'use client';

import { useState, useEffect } from 'react';
import { fetcher } from './api';
import { getSchoolSlug, getEnv } from './env';

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

export interface SchoolInfoState {
  info: SchoolInfo | null;
  /**
   * True once the network fetch has finished (successfully or not) for this
   * page load. Lets the splash screen distinguish "still loading" from
   * "failed / no tenant" and fall back to a welcome message instead of
   * waiting out its full timeout.
   */
  settled: boolean;
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
let _settled = false;

/** Lazily-fetched base64 logo, kept out of `/school/info` (see below). */
let _logoDataUrl: string | null = null;
let _logoInflight: Promise<string | null> | null = null;

/**
 * Returns the current school's public info plus whether the fetch has
 * settled. `GET /school/info` is intentionally lightweight (no base64 logo);
 * the logo itself is loaded by the browser straight from `logoUrl`.
 */
export function useSchoolInfoState(): SchoolInfoState {
  const [info, setInfo] = useState<SchoolInfo | null>(_cache);
  const [settled, setSettled] = useState(_settled);

  useEffect(() => {
    let cancelled = false;
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

    // 2. localStorage hit — instant logo URL on repeat visits, even before
    //    the network answers.
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed: SchoolInfo = JSON.parse(raw);
        if (!_cache) {
          _cache = parsed;
          _cacheKey = lsKey;
        }
        setInfo(_cache);
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
              logoDataUrl: null,
              logoUpdatedAt: data.logoUpdatedAt ?? null,
            };
            _cache = result;
            _cacheKey = lsKey;
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
          _settled = true;
          _inflight = null;
        });
    }

    // Always update state when fresh data arrives. Use a fresh object reference
    // so React always re-renders, even if the user previously saw a stale copy.
    if (_inflight) {
      _inflight.then((data) => {
        if (cancelled) return;
        if (data) setInfo({ ...data });
        setSettled(true);
      });
    } else {
      setSettled(true);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { info, settled };
}

/**
 * Returns the current school's public info (name, tagline, address, …).
 * Fetches once from `GET /school/info`, then serves from an in-memory cache
 * or localStorage — so subsequent callers (e.g. ReceiptModal) get the value
 * instantly with zero extra API calls.
 */
export function useSchoolInfo(): SchoolInfo | null {
  return useSchoolInfoState().info;
}

/**
 * Lazily fetches the school logo as a base64 data URL, for embedding in PDFs
 * and print/PNG output where a cross-origin S3 URL would taint the canvas.
 *
 * This used to ride along on every `GET /school/info` response, which made
 * that hot endpoint hundreds of KB; now callers that actually need it (salary
 * slip PDF, visitor QR poster) request it at generation time via the API's
 * `/school/logo` proxy. Cached per tab after the first call.
 */
export async function getSchoolLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  if (_logoInflight) return _logoInflight;

  const apiBase = getEnv('API_URL') || 'http://localhost:3000';
  const slug = getSchoolSlug() || '';

  _logoInflight = fetch(`${apiBase}/school/logo`, {
    headers: slug ? { 'X-School-Slug': slug } : undefined,
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      _logoDataUrl = dataUrl;
      return dataUrl;
    })
    .catch(() => null)
    .finally(() => {
      _logoInflight = null;
    });

  return _logoInflight;
}
