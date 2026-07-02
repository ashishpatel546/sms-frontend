'use client';

import { getAiHeaders, getAiBackendUrl } from './ai-auth';

export interface SseUsage {
  credits_charged: number;
  credits_remaining: number;
}

export interface StreamOptions {
  onToken: (text: string) => void;
  onDone: (usage: SseUsage | null) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * POSTs to a school-ai SSE endpoint and streams the response.
 *
 * SSE event shapes:
 *   {"type":"token","content":"..."}
 *   {"type":"usage","credits_charged":N,"credits_remaining":N}
 *   {"type":"done"}
 *   {"type":"error","message":"..."}
 */
export async function streamAiResponse(
  path: string,
  body: Record<string, unknown>,
  opts: StreamOptions,
): Promise<void> {
  const { onToken, onDone, onError, signal } = opts;

  try {
    const headers = await getAiHeaders();
    const base = getAiBackendUrl();

    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg =
        errBody?.detail ||
        errBody?.message ||
        errBody?.error_code ||
        `HTTP ${res.status}`;
      onError(msg);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let usage: SseUsage | null = null;
    let finished = false;

    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const event = JSON.parse(raw);
          if (event.type === 'token') {
            onToken(event.content ?? '');
          } else if (event.type === 'usage') {
            usage = {
              credits_charged: event.credits_charged,
              credits_remaining: event.credits_remaining,
            };
          } else if (event.type === 'done') {
            finished = true;
            break;
          } else if (event.type === 'error') {
            onError(event.message ?? 'AI service error');
            return;
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    onDone(usage);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onDone(null);
      return;
    }
    onError(err instanceof Error ? err.message : 'Unknown error');
  }
}
