'use client';

import { API_BASE_URL } from '@/lib/api';
import { authFetch, getUser } from '@/lib/auth';
import { getEnv, getSchoolSlug } from '@/lib/env';

/**
 * Client for the AI Assistant (sms-agent).
 *
 * Same shape as the school-ai integration: sms-backend exchanges the user's
 * session for a short-lived assistant token (`POST /agent/session`), and the
 * browser then talks to sms-agent directly — streaming needs to reach the
 * device without a proxy in between. The assistant token only works on the
 * assistant API, so holding it in sessionStorage exposes nothing new.
 */

export function getAssistantUrl(): string {
  return getEnv('AGENT_API_URL') || 'http://localhost:4030';
}

// ── Assistant session token ─────────────────────────────────────────────────

interface StoredToken {
  token: string;
  expiresAt: number;
  owner: string;
  /** The assistant session (= conversation) the token belongs to. */
  sessionId?: string;
}

const TOKEN_KEY = 'assistant_session';
/** Last assistant session, kept past its token so a refresh can resume it. */
const SESSION_KEY = 'assistant_session_id';
const REFRESH_BUFFER_MS = 3 * 60_000;
let inflight: Promise<string> | null = null;

/** Tokens belong to one person in one school; switching either drops it. */
function ownerId(): string {
  return `${getSchoolSlug()}:${getUser()?.sub ?? ''}`;
}

function readToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

/** Drops the token; the next one resumes the same session if it is still live. */
export function clearAssistantToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Drops the token and the session: the next token starts a new conversation. */
export function forgetAssistantSession() {
  clearAssistantToken();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function lastSessionId(): string | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as { id: string; owner: string }) : null;
    return s && s.owner === ownerId() ? s.id : undefined;
  } catch {
    return undefined;
  }
}

export class AssistantError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

async function readError(res: Response, fallback: string): Promise<AssistantError> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string | string[];
  };
  const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
  const code =
    body.code ??
    (res.status === 402
      ? 'CREDITS_EXHAUSTED'
      : res.status === 403
        ? 'FORBIDDEN'
        : res.status === 401
          ? 'SESSION_EXPIRED'
          : 'FAILED');
  return new AssistantError(code, message || fallback, res.status);
}

export async function getAssistantToken(force = false): Promise<string> {
  const stored = readToken();
  if (
    !force &&
    stored &&
    stored.owner === ownerId() &&
    Date.now() < stored.expiresAt - REFRESH_BUFFER_MS
  ) {
    return stored.token;
  }
  if (!inflight) {
    inflight = (async () => {
      // Continue the conversation if it is still live; sms-backend starts a
      // new session when it ended (new chat, or idle too long).
      const resume = lastSessionId();
      const res = await authFetch(`${API_BASE_URL}/agent/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resume ? { resume } : {}),
      });
      if (!res.ok) throw await readError(res, 'Could not start the assistant.');
      const data = (await res.json()) as { token: string; expiresAt: string; sessionId: string };
      const value: StoredToken = {
        token: data.token,
        expiresAt: Date.parse(data.expiresAt),
        owner: ownerId(),
        sessionId: data.sessionId,
      };
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value));
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ id: data.sessionId, owner: value.owner }),
        );
      } catch {
        /* storage unavailable: keep it for this call only */
      }
      return data.token;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Calls sms-agent; on an expired session mints a fresh token and retries once. */
async function assistantFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = async (force: boolean) => {
    const token = await getAssistantToken(force);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${getAssistantUrl()}${path}`, { ...init, headers });
  };
  let res: Response;
  try {
    res = await send(false);
    if (res.status === 401) res = await send(true);
  } catch (err) {
    if (err instanceof AssistantError) throw err;
    if ((err as Error).name === 'AbortError') throw err;
    throw new AssistantError(
      'OFFLINE',
      "Can't reach the assistant. Check your connection and try again.",
    );
  }
  return res;
}

// ── Types shared with sms-agent ─────────────────────────────────────────────

export interface Draft {
  action_ids: string[];
  summary: string;
  expires_at: string | null;
}

export type DraftState = 'pending' | 'done' | 'cancelled' | 'failed';

export interface ActionResult {
  ok: boolean;
  outcome: 'done' | 'cancelled' | 'failed' | 'partial';
  text: string;
  actionIds: string[];
  /** Balance after the change (Confirm / Cancel button answers only). */
  credits?: { remaining: number; limit: number };
}

export type AssistantEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'status'; tool: string; label: string }
  | { type: 'token'; text: string }
  | { type: 'draft'; drafts: Draft[] }
  | ({ type: 'action' } & ActionResult)
  | { type: 'usage'; credits: number; remaining: number; limit: number }
  | { type: 'done'; text: string }
  | { type: 'error'; code: string; message: string };

export interface Capabilities {
  model: string;
  /** This session's conversation; a different id than before means a fresh one. */
  conversationId: string;
  idleMinutes: number;
  credits: { remaining: number; limit: number; month: string };
  confirmMode: 'agent' | 'user';
  voice: { transcribe: boolean; speak: boolean };
  limits: { maxMessageChars: number; maxAudioSeconds: number };
}

export interface StoredConversation {
  id: string;
  transcript: {
    role: 'user' | 'assistant';
    text: string;
    at: string;
    drafts?: (Draft & { state: DraftState })[];
  }[];
  pending: Draft[];
}

// ── Calls ───────────────────────────────────────────────────────────────────

export async function getCapabilities(): Promise<Capabilities> {
  const res = await assistantFetch('/v1/capabilities');
  if (!res.ok) throw await readError(res, 'The assistant is unavailable.');
  return res.json();
}

export async function getConversation(id: string): Promise<StoredConversation | null> {
  const res = await assistantFetch(`/v1/conversations/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, 'Could not load the conversation.');
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await assistantFetch(`/v1/conversations/${id}`, { method: 'DELETE' }).catch(() => undefined);
}

/** Sends a message and calls `onEvent` for each streamed event. */
export async function streamChat(
  body: { message: string; conversationId?: string; mode: 'text' | 'voice' },
  onEvent: (e: AssistantEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await assistantFetch('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await readError(res, 'The assistant could not answer.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as AssistantEvent);
        } catch {
          /* ignore a malformed line */
        }
      }
    }
  }
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await assistantFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, fallback);
  return res.json();
}

/**
 * Approve drafted changes. In "user" confirm mode the approval itself is made
 * with the person's own session (the assistant token is not allowed to), and
 * sms-agent then runs exactly the confirmed request.
 */
export async function confirmDrafts(
  conversationId: string,
  actionIds: string[],
  mode: Capabilities['confirmMode'],
): Promise<ActionResult> {
  if (mode === 'agent') {
    return postJson('/v1/actions/confirm', { conversationId, actionIds }, 'Could not save the change.');
  }
  const actions: { id: string; request: unknown }[] = [];
  for (const id of actionIds) {
    const res = await authFetch(`${API_BASE_URL}/agent/actions/${id}/confirm`, {
      method: 'POST',
    });
    if (!res.ok) throw await readError(res, 'Could not confirm the change.');
    const exec = (await res.json()) as { request: unknown };
    actions.push({ id, request: exec.request });
  }
  return postJson('/v1/actions/execute', { conversationId, actions }, 'Could not save the change.');
}

export function cancelDrafts(conversationId: string, actionIds: string[]): Promise<ActionResult> {
  return postJson('/v1/actions/cancel', { conversationId, actionIds }, 'Could not cancel the draft.');
}

// ── Voice (server) ──────────────────────────────────────────────────────────

export async function transcribe(audio: Blob, durationMs: number): Promise<string> {
  const res = await assistantFetch('/v1/voice/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': audio.type || 'audio/webm',
      'X-Audio-Duration-Ms': String(Math.round(durationMs)),
    },
    body: audio,
  });
  if (!res.ok) throw await readError(res, "Couldn't make out the audio. Try again.");
  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function speak(text: string, signal?: AbortSignal): Promise<Blob> {
  const res = await assistantFetch('/v1/voice/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw await readError(res, "Couldn't read the reply aloud.");
  return res.blob();
}
