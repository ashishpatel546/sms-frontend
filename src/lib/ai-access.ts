'use client';
/**
 * useAiAccess — returns the user's AI subscription features from cache or API.
 * Calls school-ai directly (same as streaming) so it works regardless of
 * whether sms-backend has AI_PLATFORM_URL configured.
 * Caches in sessionStorage for 5 minutes so every feature page doesn't
 * independently call the status endpoint.
 */
import { useEffect, useState } from 'react';
import { getAiHeaders, getAiBackendUrl } from '@/lib/ai-auth';

export interface AiAccess {
  loading: boolean;
  hasActivePlan: boolean;
  planName: string;
  planDisplayName: string;
  features: Record<string, boolean>;
  roles: string[]; // AI platform roles: 'teacher' | 'student'
  featureRoles: Record<string, string[]>; // feature → allowed roles (hub-configurable)
}

const CACHE_KEY = 'ai_access_v2';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache(): AiAccess | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as AiAccess;
  } catch {
    return null;
  }
}

function writeCache(data: AiAccess) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearAiAccessCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

const DEFAULT: AiAccess = {
  loading: true,
  hasActivePlan: false,
  planName: '',
  planDisplayName: '',
  features: {},
  roles: [],
  featureRoles: {},
};

export function useAiAccess(): AiAccess {
  const [access, setAccess] = useState<AiAccess>(DEFAULT);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setAccess({ ...cached, loading: false });
      return;
    }

    // Call school-ai directly (same auth path as streaming)
    getAiHeaders()
      .then((headers) =>
        fetch(`${getAiBackendUrl()}/api/v1/subscription/status`, { headers }),
      )
      .then((r) => r.json())
      .then((json) => {
        const raw = json?.data ?? json;
        const result: AiAccess = {
          loading: false,
          hasActivePlan: raw.has_active_plan ?? false,
          planName: raw.plan?.name ?? '',
          planDisplayName: raw.plan?.display_name ?? '',
          features: raw.plan?.features ?? {},
          roles: raw.roles ?? [],
          featureRoles: raw.feature_roles ?? {},
        };
        writeCache(result);
        setAccess(result);
      })
      .catch(() => {
        setAccess({ ...DEFAULT, loading: false });
      });
  }, []);

  return access;
}
