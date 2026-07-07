'use client';
/**
 * useAiAccess — returns the user's AI subscription features from cache or API.
 * Calls school-ai directly (same as streaming) so it works regardless of
 * whether sms-backend has AI_PLATFORM_URL configured.
 * Caches in sessionStorage for 5 minutes so every feature page doesn't
 * independently call the status endpoint.
 */
import { useEffect, useState } from 'react';
import { getAiHeaders, getAiBackendUrl, clearAiToken } from '@/lib/ai-auth';

export interface AiAccess {
  loading: boolean;
  hasActivePlan: boolean;
  planName: string;
  planDisplayName: string;
  features: Record<string, boolean>;
  roles: string[]; // AI platform roles: 'teacher' | 'student'
  featureRoles: Record<string, string[]>; // feature → allowed roles (hub-configurable)
  /** True when the status check itself failed (AI service unreachable / bad
   *  response) — the user's plan is UNKNOWN, not absent. Gates must show a
   *  connection error, never the "subscribe" upsell. */
  unreachable: boolean;
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
  unreachable: false,
};

export function useAiAccess(): AiAccess & { refetch: () => void } {
  const [access, setAccess] = useState<AiAccess>(DEFAULT);
  const [retryCount, setRetryCount] = useState(0);

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
      .then((r) => {
        if (!r.ok) throw new Error(`subscription status ${r.status}`);
        return r.json();
      })
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
          unreachable: false,
        };
        writeCache(result);
        setAccess(result);
      })
      .catch(() => {
        // Couldn't determine the plan (AI service down/unreachable from this
        // device, or auth failed). Never cached — the next mount retries.
        setAccess({ ...DEFAULT, loading: false, unreachable: true });
      });
  }, [retryCount]);

  const refetch = () => {
    // A manual retry forces a fully fresh check — drop any cached
    // "no active plan" result and the cached AI session token.
    clearAiAccessCache();
    clearAiToken();
    setAccess((prev) => ({ ...prev, loading: true }));
    setRetryCount((n) => n + 1);
  };

  return { ...access, refetch };
}
