'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api';
import { authFetch } from './auth';
import { getSchoolSlug } from './env';

export type FeatureMap = Record<string, boolean>;

/**
 * Loading is deliberately distinct from `error`: a module that is genuinely
 * switched off should show an upsell, whereas an unreachable API should not.
 */
export type FeatureStatus = 'loading' | 'ready' | 'error';

/**
 * Shared cache, keyed by school slug so multiple tabs on different subdomains
 * stay correct. One in-flight promise means a page that gates several things
 * at once still makes a single request.
 *
 * The TTL matters: a plan change made in the hub console has to reach an open
 * tab without the user knowing to hard-reload. A minute keeps the request count
 * negligible while making "I switched the plan and nothing happened" go away on
 * its own.
 */
const CACHE_TTL_MS = 60_000;

let _cache: FeatureMap | null = null;
let _cacheKey: string | null = null;
let _cachedAt = 0;
let _inflight: Promise<FeatureMap | null> | null = null;

function cacheIsFresh(slug: string): boolean {
  return (
    _cacheKey === slug && _cache !== null && Date.now() - _cachedAt < CACHE_TTL_MS
  );
}

/** Drops the cache so the next read reflects a just-changed plan. */
export function clearSchoolFeaturesCache(): void {
  _cache = null;
  _cacheKey = null;
  _cachedAt = 0;
  _inflight = null;
}

async function fetchFeatures(): Promise<FeatureMap | null> {
  const res = await authFetch(`${API_BASE_URL}/school/features`);
  if (!res.ok) return null;
  return (await res.json()) as FeatureMap;
}

/**
 * The features this school actually has — its plan's baseline merged with any
 * per-school overrides, resolved server-side so the menu can never offer
 * something the API would reject.
 *
 * Replaces the near-identical `useEffect` + `authFetch` block that used to be
 * copy-pasted into every gated route layout.
 */
export function useSchoolFeatures(): {
  features: FeatureMap;
  status: FeatureStatus;
} {
  const slug = typeof window === 'undefined' ? '' : getSchoolSlug() || '';
  const [features, setFeatures] = useState<FeatureMap>(
    cacheIsFresh(slug) && _cache ? _cache : {},
  );
  const [status, setStatus] = useState<FeatureStatus>(
    cacheIsFresh(slug) ? 'ready' : 'loading',
  );

  useEffect(() => {
    let cancelled = false;

    if (cacheIsFresh(slug) && _cache) {
      setFeatures(_cache);
      setStatus('ready');
      return;
    }

    if (!_inflight || _cacheKey !== slug) {
      _cacheKey = slug;
      _inflight = fetchFeatures().finally(() => {
        _inflight = null;
      });
    }

    _inflight
      .then((map) => {
        if (cancelled) return;
        if (!map) {
          setStatus('error');
          return;
        }
        _cache = map;
        _cacheKey = slug;
        _cachedAt = Date.now();
        setFeatures(map);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { features, status };
}

/**
 * Convenience wrapper for a single flag.
 *
 * `enabled` is `null` while loading or unreachable, so callers can tell
 * "not yet known" apart from "switched off" — the difference between showing a
 * spinner and showing an upsell.
 */
export function useFeatureFlag(flag: string): {
  enabled: boolean | null;
  status: FeatureStatus;
} {
  const { features, status } = useSchoolFeatures();
  return {
    enabled: status === 'ready' ? features[flag] === true : null,
    status,
  };
}
