'use client';

import { getAuthHeaders } from './auth';
import { getEnv } from './env';

const AI_TOKEN_KEY = 'ai_session_token';
const AI_TOKEN_EXPIRY_KEY = 'ai_session_expiry';
// Refresh if less than 5 minutes remain
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Base URL of the sms-backend (same origin as the rest of the app) */
function getSmsApiUrl(): string {
  return getEnv('API_URL') || 'http://localhost:3000';
}

/** Public URL of the school-ai FastAPI service (for direct streaming calls) */
export function getAiBackendUrl(): string {
  return getEnv('AI_API_URL') || 'http://localhost:8001';
}

export function clearAiToken(): void {
  sessionStorage.removeItem(AI_TOKEN_KEY);
  sessionStorage.removeItem(AI_TOKEN_EXPIRY_KEY);
}

function isAiTokenFresh(): boolean {
  const expiry = sessionStorage.getItem(AI_TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() < parseInt(expiry, 10) - REFRESH_BUFFER_MS;
}

/**
 * Returns a valid AI session JWT.
 * Fetches from sms-backend POST /ai/session on first call or when the
 * cached token is about to expire.  Cached in sessionStorage (cleared on
 * tab close).
 */
export async function getAiToken(): Promise<string> {
  const cached = sessionStorage.getItem(AI_TOKEN_KEY);
  if (cached && isAiTokenFresh()) return cached;

  const headers = getAuthHeaders();
  const res = await fetch(`${getSmsApiUrl()}/ai/session`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `AI session error: ${res.status}`);
  }

  const data: { token: string; expires_in: number } = await res.json();
  const expiryMs = Date.now() + data.expires_in * 1000;

  sessionStorage.setItem(AI_TOKEN_KEY, data.token);
  sessionStorage.setItem(AI_TOKEN_EXPIRY_KEY, String(expiryMs));

  return data.token;
}

/** Returns headers for direct calls to the school-ai service. */
export async function getAiHeaders(): Promise<Record<string, string>> {
  const token = await getAiToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
