'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AssistantError,
  cancelDrafts,
  clearAssistantToken,
  confirmDrafts,
  deleteConversation,
  forgetAssistantSession,
  getCapabilities,
  getConversation,
  streamChat,
  type ActionResult,
  type AssistantEvent,
  type Capabilities,
  type Draft,
  type DraftState,
} from '@/lib/assistant/client';

export interface DraftItem extends Draft {
  state: DraftState;
  /** Set while Confirm / Cancel is in flight. */
  working?: 'confirm' | 'cancel';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant is doing right now (streaming only). */
  status?: string;
  streaming?: boolean;
  drafts?: DraftItem[];
  error?: { code: string; message: string };
  /** The reply to a spoken question — read aloud when replies are spoken. */
  spoken?: boolean;
}

export interface Credits {
  remaining: number;
  limit: number;
}

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

function outcomeState(r: ActionResult): DraftState {
  if (r.outcome === 'cancelled') return 'cancelled';
  if (r.outcome === 'failed') return 'failed';
  return 'done';
}

export function useAssistantChat(active: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [startError, setStartError] = useState<AssistantError | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  /** A new chat still ending the old session; the next message waits for it. */
  const resetting = useRef<Promise<void> | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Each open: capabilities, and the conversation if it is still live. The
  // conversation is the assistant session; one that ended (a new chat, or
  // idle past the backend's limit) comes back under a new id, and the panel
  // starts fresh.
  useEffect(() => {
    if (!active) loaded.current = false;
  }, [active]);

  useEffect(() => {
    if (!active || loaded.current) return;
    loaded.current = true;
    (async () => {
      let c: Capabilities;
      try {
        await resetting.current;
        c = await getCapabilities();
        setCaps(c);
        setCredits({ remaining: c.credits.remaining, limit: c.credits.limit });
        setStartError(null);
      } catch (err) {
        loaded.current = false;
        setStartError(
          err instanceof AssistantError
            ? err
            : new AssistantError('FAILED', 'The assistant is unavailable right now.'),
        );
        return;
      }
      if (c.conversationId === conversationId.current) return;
      conversationId.current = c.conversationId;
      const conv = await getConversation(c.conversationId).catch(() => null);
      setMessages(
        !conv
          ? []
          : 
        conv.transcript.map((t) => ({
              id: nextId(),
              role: t.role,
              text: t.text,
              drafts: t.drafts?.map((d) => ({ ...d })),
            })),
      );
    })();
  }, [active, attempt]);

  const retryStart = useCallback(() => {
    loaded.current = false;
    setStartError(null);
    setAttempt((a) => a + 1);
  }, []);

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  /** Marks drafts anywhere in the thread by action id. */
  const markDrafts = useCallback((ids: string[], state: DraftState) => {
    const set = new Set(ids);
    setMessages((ms) =>
      ms.map((m) =>
        m.drafts?.some((d) => d.action_ids.some((a) => set.has(a)))
          ? {
              ...m,
              drafts: m.drafts.map((d) =>
                d.action_ids.some((a) => set.has(a)) ? { ...d, state, working: undefined } : d,
              ),
            }
          : m,
      ),
    );
  }, []);

  const send = useCallback(
    async (text: string, mode: 'text' | 'voice' = 'text'): Promise<ChatMessage | null> => {
      const message = text.trim();
      if (!message || busy) return null;
      const reply: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        text: '',
        streaming: true,
        spoken: mode === 'voice',
      };
      const question: ChatMessage = { id: nextId(), role: 'user', text: message };
      setMessages((ms) => [...ms, question, reply]);
      setBusy(true);
      await resetting.current;
      const ctrl = new AbortController();
      abort.current = ctrl;
      let final: ChatMessage = reply;

      const onEvent = (e: AssistantEvent) => {
        switch (e.type) {
          case 'start':
            // A different session means the earlier conversation ended:
            // this question opens a fresh one.
            if (conversationId.current && e.conversationId !== conversationId.current) {
              setMessages((ms) => ms.filter((m) => m.id === question.id || m.id === reply.id));
            }
            conversationId.current = e.conversationId;
            break;
          case 'status':
            patch(reply.id, (m) => ({ ...m, status: e.label }));
            break;
          case 'token':
            patch(reply.id, (m) => ({ ...m, text: m.text + e.text, status: undefined }));
            final = { ...final, text: final.text + e.text };
            break;
          case 'draft': {
            // A new draft replaces anything still pending from earlier.
            setMessages((ms) =>
              ms.map((m) =>
                m.drafts?.some((d) => d.state === 'pending')
                  ? {
                      ...m,
                      drafts: m.drafts.map((d) =>
                        d.state === 'pending' ? { ...d, state: 'cancelled' as const } : d,
                      ),
                    }
                  : m,
              ),
            );
            const drafts = e.drafts.map((d) => ({ ...d, state: 'pending' as const }));
            patch(reply.id, (m) => ({ ...m, drafts }));
            break;
          }
          case 'action':
            markDrafts(e.actionIds, outcomeState(e));
            break;
          case 'usage':
            setCredits({ remaining: e.remaining, limit: e.limit });
            break;
          case 'error':
            if (e.code === 'SESSION_ENDED' && !retried) {
              // Idle too long: ask again in a fresh conversation.
              ended = true;
              break;
            }
            // The next request mints a fresh assistant token.
            if (e.code === 'SESSION_EXPIRED') clearAssistantToken();
            patch(reply.id, (m) => ({ ...m, error: { code: e.code, message: e.message } }));
            final = { ...final, error: { code: e.code, message: e.message } };
            if (e.code === 'CREDITS_EXHAUSTED') {
              setCredits((c) => (c ? { ...c, remaining: 0 } : { remaining: 0, limit: 0 }));
            }
            break;
        }
      };

      let retried = false;
      let ended = false;
      try {
        await streamChat(
          { message, conversationId: conversationId.current, mode },
          onEvent,
          ctrl.signal,
        );
        if (ended) {
          retried = true;
          forgetAssistantSession();
          patch(reply.id, (m) => ({ ...m, text: '', status: undefined }));
          final = reply;
          await streamChat({ message, mode }, onEvent, ctrl.signal);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const e =
            err instanceof AssistantError
              ? err
              : new AssistantError('FAILED', 'The assistant could not answer. Try again.');
          patch(reply.id, (m) => ({ ...m, error: { code: e.code, message: e.message } }));
          final = { ...final, error: { code: e.code, message: e.message } };
        }
      } finally {
        patch(reply.id, (m) => ({
          ...m,
          streaming: false,
          status: undefined,
          text: m.text || (ctrl.signal.aborted && !m.error ? 'Stopped.' : m.text),
        }));
        abort.current = null;
        setBusy(false);
      }
      return final;
    },
    [busy, markDrafts, patch],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const decide = useCallback(
    async (messageId: string, draftIndex: number, decision: 'confirm' | 'cancel') => {
      const msg = messages.find((m) => m.id === messageId);
      const draft = msg?.drafts?.[draftIndex];
      const convId = conversationId.current;
      if (!draft || draft.state !== 'pending' || !convId || !caps) return null;
      patch(messageId, (m) => ({
        ...m,
        drafts: m.drafts?.map((d, i) => (i === draftIndex ? { ...d, working: decision } : d)),
      }));
      try {
        const result =
          decision === 'confirm'
            ? await confirmDrafts(convId, draft.action_ids, caps.confirmMode)
            : await cancelDrafts(convId, draft.action_ids);
        markDrafts(draft.action_ids, outcomeState(result));
        if (result.credits) setCredits(result.credits);
        const note: ChatMessage = { id: nextId(), role: 'assistant', text: result.text };
        setMessages((ms) => [...ms, note]);
        return note;
      } catch (err) {
        const e =
          err instanceof AssistantError
            ? err
            : new AssistantError('FAILED', 'That did not go through. Try again.');
        patch(messageId, (m) => ({
          ...m,
          drafts: m.drafts?.map((d, i) => (i === draftIndex ? { ...d, working: undefined } : d)),
        }));
        const note: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          text: '',
          error: { code: e.code, message: e.message },
        };
        setMessages((ms) => [...ms, note]);
        return note;
      }
    },
    [caps, markDrafts, messages, patch],
  );

  /** Ends the conversation (and its assistant session); the next message starts fresh. */
  const newChat = useCallback(() => {
    abort.current?.abort();
    const old = conversationId.current;
    conversationId.current = undefined;
    setMessages([]);
    const ending = old ? deleteConversation(old) : Promise.resolve();
    resetting.current = ending.finally(() => {
      forgetAssistantSession();
      resetting.current = null;
    });
  }, []);

  return {
    messages,
    busy,
    credits,
    caps,
    startError,
    retryStart,
    send,
    stop,
    decide,
    newChat,
  };
}
