'use client';

import { getAiHeaders, getAiBackendUrl } from './ai-auth';

/** POSTs JSON to a non-streaming school-ai endpoint and returns the parsed body. */
export async function postAiJson<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const headers = await getAiHeaders();
  const res = await fetch(`${getAiBackendUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = errBody?.detail;
    const msg =
      (typeof detail === 'string' ? detail : detail?.message) ||
      errBody?.message ||
      errBody?.error_code ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}
