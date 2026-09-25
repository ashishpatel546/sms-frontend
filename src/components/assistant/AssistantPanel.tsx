'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  CalendarCheck,
  ClipboardList,
  Loader2,
  Mic,
  RotateCcw,
  SquarePen,
  Square,
  Sun,
  UserRoundCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { AssistantError } from '@/lib/assistant/client';
import {
  canRecogniseOnDevice,
  canRecord,
  Speaker,
  startListening,
  type Listening,
} from '@/lib/assistant/voice';
import { useAssistant } from './AssistantProvider';
import { DraftCard } from './DraftCard';
import { useAssistantChat, type ChatMessage, type Credits } from './useAssistantChat';

const SPEAK_KEY = 'assistant_speak_replies';
/** A press shorter than this is a tap: the mic stays on until Done. */
const TAP_MS = 350;
/** Sliding this far from the mic while holding cancels on release. */
const CANCEL_PX = 72;

interface Hold {
  downAt: number;
  x: number;
  y: number;
  released: boolean;
  cancel: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HR_ADMIN'];

function suggestionsFor(roles: string[]) {
  const admin = roles.some((r) => ADMIN_ROLES.includes(r));
  return [
    { icon: Sun, text: "What's happening today?" },
    admin
      ? { icon: ClipboardList, text: "Which classes haven't taken attendance yet?" }
      : { icon: ClipboardList, text: 'Mark attendance for my class' },
    { icon: UserRoundCheck, text: 'Leave requests waiting for me' },
    { icon: CalendarCheck, text: 'How many leaves do I have left?' },
  ];
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function CreditsLine({ credits }: { credits: Credits | null }) {
  if (!credits || credits.limit <= 0) return null;
  const share = credits.remaining / credits.limit;
  const tone =
    credits.remaining <= 0
      ? 'text-accent-danger-deep'
      : share < 0.1
        ? 'text-accent-warn-deep'
        : 'text-ink-faint';
  return (
    <p className={`font-mono text-[11px] tabular-nums ${tone}`}>
      {credits.remaining <= 0
        ? 'No credits left this month'
        : `${credits.remaining.toLocaleString('en-IN')} of ${credits.limit.toLocaleString('en-IN')} credits left`}
    </p>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        a: ({ children, href }) => (
          <a href={href} className="text-accent-info underline underline-offset-2">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded-sm bg-surface-secondary px-1 font-mono text-[12.5px]">{children}</code>
        ),
        h1: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
        h2: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
        h3: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

const ERROR_HELP: Record<string, string> = {
  CREDITS_EXHAUSTED: 'An administrator can add credits from the platform console.',
  OFFLINE: '',
  RATE_LIMITED: '',
};

function AssistantMessage({
  m,
  onDecide,
  onRetry,
}: {
  m: ChatMessage;
  onDecide: (index: number, decision: 'confirm' | 'cancel') => void;
  onRetry?: () => void;
}) {
  return (
    <div className="border-l-2 border-accent-ai-edge pl-3">
      {m.text && (
        <div className="text-[14px] leading-relaxed text-ink-soft">
          <Markdown text={m.text} />
          {m.streaming && (
            <span
              className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent-ai motion-reduce:animate-none"
              aria-hidden
            />
          )}
        </div>
      )}
      {m.streaming && !m.text && (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-muted" role="status">
          <Loader2 className="size-3.5 animate-spin text-accent-ai motion-reduce:animate-none" aria-hidden />
          {m.status ?? 'Thinking'}
        </p>
      )}
      {m.streaming && m.text && m.status && (
        <p className="mt-1 text-[12px] text-ink-muted" role="status">
          {m.status}
        </p>
      )}
      {m.drafts?.map((d, i) => (
        <DraftCard
          key={d.action_ids.join(',')}
          draft={d}
          onConfirm={() => onDecide(i, 'confirm')}
          onCancel={() => onDecide(i, 'cancel')}
        />
      ))}
      {m.error && (
        <div className="mt-1 rounded-md border border-accent-danger-edge bg-accent-danger-tint px-3 py-2 text-[13px] text-accent-danger-deep">
          <p>{m.error.message}</p>
          {ERROR_HELP[m.error.code] && <p className="mt-0.5 text-ink-muted">{ERROR_HELP[m.error.code]}</p>}
          {onRetry && m.error.code !== 'CREDITS_EXHAUSTED' && m.error.code !== 'FORBIDDEN' && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 inline-flex cursor-pointer items-center gap-1 font-semibold text-accent-danger-deep underline-offset-2 hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function AssistantPanel() {
  const { open, setOpen, available } = useAssistant();
  const chat = useAssistantChat(open);
  const { messages, busy, credits, caps, startError, send, stop, decide, newChat, retryStart } = chat;

  const [draftText, setDraftText] = useState('');
  const [listening, setListening] = useState<Listening | null>(null);
  /** Started with a tap (or assistive tech): listens until Done. */
  const [handsFree, setHandsFree] = useState(false);
  /** Slid away from the mic while holding: releasing throws the recording away. */
  const [armedCancel, setArmedCancel] = useState(false);
  const [listenStart, setListenStart] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(() => {
    try {
      return localStorage.getItem(SPEAK_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [elapsed, setElapsed] = useState(0);
  /** Server transcription turned out unavailable: use the device's recognition. */
  const [serverSttDown, setServerSttDown] = useState(false);
  /** The device's recognition failed: use server transcription. */
  const [deviceSttDown, setDeviceSttDown] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  const speaker = useRef<Speaker | null>(null);
  const [lastSent, setLastSent] = useState<{ text: string; mode: 'text' | 'voice' } | null>(null);
  const stopListeningRef = useRef<() => void>(() => undefined);
  const listenRef = useRef<Listening | null>(null);
  const hold = useRef<Hold | null>(null);
  /** The click that follows a press we already handled. */
  const pressed = useRef(false);

  const user = typeof window !== 'undefined' ? getUser() : null;
  const roles = [user?.role, ...((user as { roles?: string[] } | null)?.roles ?? [])].filter(
    (r): r is string => !!r,
  );
  const outOfCredits = credits !== null && credits.limit > 0 && credits.remaining <= 0;
  const voiceIn = caps?.voice.input ?? 'device';
  const voiceOut = caps?.voice.output ?? 'device';
  const serverSttReady = !!caps?.voice.transcribe && !serverSttDown && canRecord();
  // The school's choice comes first; the other route is the fallback.
  const serverVoice =
    voiceIn === 'server'
      ? serverSttReady
      : voiceIn === 'device' && serverSttReady && (!canRecogniseOnDevice() || deviceSttDown);
  const canListen = voiceIn !== 'off' && (serverVoice || canRecogniseOnDevice());
  // The school can switch reading aloud off in the hub.
  const readAloud = speakReplies && voiceOut !== 'off';

  useEffect(() => {
    speaker.current ??= new Speaker();
    speaker.current.configure(caps?.voice.output === 'server' ? 'server' : 'device', !!caps?.voice.speak);
  }, [caps]);

  // Focus the composer on open; stop audio and listening on close.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => input.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    speaker.current?.stop();
    listenRef.current?.cancel();
    listenRef.current = null;
    hold.current = null;
    // Closing the panel ends any recording; nothing else owns this state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListening(null);
  }, [open]);

  // Follow the conversation unless the person has scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Mic timer.
  useEffect(() => {
    if (!listening) return;
    const t = window.setInterval(() => setElapsed(Math.floor((performance.now() - listenStart) / 1000)), 250);
    return () => window.clearInterval(t);
  }, [listening, listenStart]);

  const toggleSpeak = () => {
    setSpeakReplies((v) => {
      const next = !v;
      try {
        localStorage.setItem(SPEAK_KEY, next ? '1' : '0');
      } catch {
        /* per-device preference only */
      }
      if (!next) speaker.current?.stop();
      return next;
    });
  };

  const submit = useCallback(
    async (text: string, mode: 'text' | 'voice') => {
      if (!text.trim() || busy) return;
      pinned.current = true;
      speaker.current?.stop();
      setLastSent({ text, mode });
      const reply = await send(text, mode);
      if (reply && mode === 'voice' && readAloud && !reply.error && reply.text) {
        void speaker.current?.say(reply.text);
      }
    },
    [busy, send, readAloud],
  );

  const onSend = () => {
    const text = draftText;
    setDraftText('');
    void submit(text, 'text');
  };

  const onDecide = async (messageId: string, index: number, decision: 'confirm' | 'cancel') => {
    const note = await decide(messageId, index, decision);
    if (note?.text && readAloud && lastSent?.mode === 'voice') {
      void speaker.current?.say(note.text);
    }
  };

  /** The device's recognition failed: fall back to server transcription if the school has it. */
  const switchToServerStt = useCallback(
    (err: unknown) => {
      if (!(err instanceof AssistantError) || err.code !== 'DEVICE_STT_FAILED') return false;
      if (!(caps?.voice.transcribe && !serverSttDown && canRecord())) return false;
      setDeviceSttDown(true);
      setVoiceError('Switched to the assistant’s voice input. Hold the mic and say it again.');
      return true;
    },
    [caps, serverSttDown],
  );

  const beginListening = async (): Promise<Listening | null> => {
    setVoiceError(null);
    speaker.current?.stop();
    try {
      const l = await startListening({
        server: serverVoice,
        maxSeconds: caps?.limits.maxAudioSeconds ?? 60,
        onAutoStop: () => stopListeningRef.current(),
      });
      listenRef.current = l;
      setListenStart(performance.now());
      setElapsed(0);
      setListening(l);
      return l;
    } catch (err) {
      if (!switchToServerStt(err)) {
        setVoiceError(err instanceof AssistantError ? err.message : "Couldn't start the microphone.");
      }
      return null;
    }
  };

  /** Stops the mic; sends what was said, or throws it away. */
  const endListening = useCallback(
    async (send: boolean) => {
      const l = listenRef.current;
      if (!l) return;
      listenRef.current = null;
      hold.current = null;
      setListening(null);
      setHandsFree(false);
      setArmedCancel(false);
      if (!send) {
        l.cancel();
        return;
      }
      setTranscribing(true);
      try {
        const text = (await l.stop()).trim();
        if (!text) {
          setVoiceError("I didn't catch that. Hold the mic while you speak, a little closer to it.");
          return;
        }
        await submit(text, 'voice');
      } catch (err) {
        if (switchToServerStt(err)) return;
        if (err instanceof AssistantError && err.code === 'VOICE_UNAVAILABLE' && canRecogniseOnDevice()) {
          setServerSttDown(true);
          setVoiceError('Switched to this device’s voice input. Hold the mic and say it again.');
          return;
        }
        setVoiceError(err instanceof AssistantError ? err.message : "Couldn't make out the audio. Try again.");
      } finally {
        setTranscribing(false);
      }
    },
    [submit, switchToServerStt],
  );

  useEffect(() => {
    stopListeningRef.current = () => void endListening(true);
  }, [endListening]);

  // Escape closes (unless the mic is live — then it cancels listening).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (listenRef.current) {
        void endListening(false);
        return;
      }
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen, endListening]);

  /** The press ended: send, throw away, or (after a tap) keep listening until Done. */
  const settleHold = (h: Hold) => {
    hold.current = null;
    if (h.cancel) void endListening(false);
    else if (performance.now() - h.downAt < TAP_MS) setHandsFree(true);
    else void endListening(true);
  };

  // Press and hold to talk; release to send; slide away to cancel.
  const pressMic = async (x: number, y: number) => {
    pressed.current = true;
    if (listenRef.current || hold.current) return;
    const h: Hold = { downAt: performance.now(), x, y, released: false, cancel: false };
    hold.current = h;
    setArmedCancel(false);
    setHandsFree(false);
    const l = await beginListening();
    if (hold.current !== h) {
      // Closed or discarded while the mic was starting.
      if (l && listenRef.current === l) void endListening(false);
      return;
    }
    if (!l) {
      hold.current = null;
      return;
    }
    if (h.released) {
      // Let go before the mic was ready (e.g. while allowing it): nothing was
      // said yet, so keep listening until Done.
      hold.current = null;
      if (h.cancel) void endListening(false);
      else setHandsFree(true);
    }
  };

  const moveMic = (x: number, y: number) => {
    const h = hold.current;
    if (!h || h.released) return;
    const away = Math.hypot(x - h.x, y - h.y) > CANCEL_PX;
    if (away !== h.cancel) {
      h.cancel = away;
      setArmedCancel(away);
    }
  };

  const releaseMic = (cancel = false) => {
    const h = hold.current;
    if (!h || h.released) return;
    h.released = true;
    if (cancel) h.cancel = true;
    if (listenRef.current) settleHold(h);
  };

  if (!available) return null;

  const empty = messages.length === 0;
  const firstName = user?.firstName?.trim();

  return (
    <>
      {/* Scrim: phones and tablets only. On a desktop the page stays usable beside the panel. */}
      <div
        className={`fixed inset-0 z-80 bg-walnut-950/40 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <section
        id="assistant-panel"
        role="dialog"
        aria-modal={false}
        aria-label="Assistant"
        aria-hidden={!open}
        inert={!open}
        className={[
          'fixed z-90 flex flex-col bg-surface shadow-glass',
          // Phone: full-height sheet from the bottom. Tablet+: a panel on the right.
          'inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+0.5rem)] rounded-t-2xl border-t border-line',
          'md:inset-y-0 md:top-0 md:right-0 md:left-auto md:w-[420px] md:rounded-none md:border-t-0 md:border-l xl:w-[440px]',
          'transition-transform duration-[260ms] ease-out motion-reduce:transition-none',
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0',
        ].join(' ')}
      >
        {/* Header */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
        <header className="flex items-center gap-1 border-b border-line py-2 pr-2 pl-4 md:pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-semibold text-ink">Assistant</h2>
            <CreditsLine credits={credits} />
          </div>
          {voiceOut !== 'off' && (
            <button
              type="button"
              onClick={toggleSpeak}
              aria-pressed={speakReplies}
              title={speakReplies ? 'Spoken questions get spoken answers' : 'Answers are not read aloud'}
              className="grid size-10 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink"
            >
              {speakReplies ? <Volume2 className="size-[18px]" aria-hidden /> : <VolumeX className="size-[18px]" aria-hidden />}
              <span className="sr-only">{speakReplies ? 'Stop reading answers aloud' : 'Read answers aloud'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              speaker.current?.stop();
              newChat();
              input.current?.focus();
            }}
            disabled={busy || empty}
            title="Start a new conversation"
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink disabled:cursor-default disabled:opacity-40"
          >
            <SquarePen className="size-4" aria-hidden />
            New chat
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-10 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-secondary hover:text-ink"
          >
            <X className="size-5" aria-hidden />
            <span className="sr-only">Close the assistant</span>
          </button>
        </header>

        {/* Conversation */}
        <div
          ref={scroller}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          aria-live="polite"
          aria-busy={busy}
        >
          {startError ? (
            <div className="mt-6 rounded-md border border-line bg-surface-secondary px-4 py-4">
              <p className="text-[14px] font-semibold text-ink">
                {startError.code === 'FORBIDDEN'
                  ? 'The assistant is not available to you'
                  : "The assistant can't start right now"}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">{startError.message}</p>
              {startError.code !== 'FORBIDDEN' && (
                <Button size="sm" variant="outline" className="mt-3" onClick={retryStart}>
                  <RotateCcw className="size-4" aria-hidden />
                  Try again
                </Button>
              )}
            </div>
          ) : empty ? (
            <div className="pt-2">
              <p className="font-display text-[20px] leading-snug font-semibold text-ink">
                {greeting()}
                {firstName ? `, ${firstName}` : ''}.
              </p>
              <p className="mt-1.5 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-muted">
                Ask about attendance, leaves, homework, fees or the day ahead, by typing or speaking. Nothing is
                saved until you confirm it.
              </p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {suggestionsFor(roles).map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <button
                      type="button"
                      disabled={!caps || busy || outOfCredits}
                      onClick={() => void submit(text, 'text')}
                      className="group flex min-h-11 w-full cursor-pointer items-center gap-3 border-l-2 border-transparent py-2.5 pr-2 pl-2 text-left text-[13.5px] text-ink-soft transition-colors hover:border-accent-ai hover:bg-accent-ai-tint hover:text-ink disabled:cursor-default disabled:opacity-50"
                    >
                      <Icon className="size-4 shrink-0 text-accent-ai" aria-hidden />
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
              {!caps && (
                <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-muted" role="status">
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                  Connecting
                </p>
              )}
            </div>
          ) : (
            <ol className="space-y-4">
              {messages.map((m, i) => (
                <li key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  {m.role === 'user' ? (
                    <p className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-secondary px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
                      {m.text}
                    </p>
                  ) : (
                    <AssistantMessage
                      m={m}
                      onDecide={(index, decision) => void onDecide(m.id, index, decision)}
                      onRetry={
                        i === messages.length - 1 && lastSent && !busy
                          ? () => void submit(lastSent.text, lastSent.mode)
                          : undefined
                      }
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {voiceError && (
            <p className="mb-2 flex items-start justify-between gap-2 text-[12.5px] text-accent-danger-deep" role="alert">
              {voiceError}
              <button
                type="button"
                className="cursor-pointer text-ink-muted hover:text-ink"
                onClick={() => setVoiceError(null)}
              >
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Dismiss</span>
              </button>
            </p>
          )}

          {listening && handsFree ? (
            <div className="flex items-center gap-3 rounded-lg border border-accent-ai-edge bg-accent-ai-tint px-3 py-2">
              <span className="assistant-listen flex items-center gap-[3px]" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="text-[13.5px] font-medium text-ink">Listening</span>
              <span className="font-mono text-[12px] text-ink-muted tabular-nums">
                0:{String(elapsed).padStart(2, '0')}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => void endListening(false)}>
                  Discard
                </Button>
                <Button size="sm" variant="primary" onClick={() => void endListening(true)}>
                  <Square className="size-3.5 fill-current" aria-hidden />
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
            >
              {listening ? (
                <div
                  className={`flex min-h-11 flex-1 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    armedCancel
                      ? 'border-accent-danger-edge bg-accent-danger-tint'
                      : 'border-accent-ai-edge bg-accent-ai-tint'
                  }`}
                  aria-live="polite"
                >
                  {!armedCancel && (
                    <span className="assistant-listen flex items-center gap-[3px]" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  <span
                    className={`text-[13.5px] font-medium whitespace-nowrap ${armedCancel ? 'text-accent-danger-deep' : 'text-ink'}`}
                  >
                    {armedCancel ? 'Release to cancel' : 'Release to send'}
                  </span>
                  <span className="font-mono text-[12px] text-ink-muted tabular-nums">
                    0:{String(elapsed).padStart(2, '0')}
                  </span>
                  {!armedCancel && (
                    <span className="ml-auto truncate text-[12px] text-ink-muted">Slide to cancel</span>
                  )}
                </div>
              ) : (
                <>
                <label htmlFor="assistant-input" className="sr-only">
                  Message the assistant
                </label>
                <textarea
                  id="assistant-input"
                  ref={input}
                  rows={1}
                  value={draftText}
                  maxLength={caps?.limits.maxMessageChars ?? 2000}
                  disabled={!!startError || outOfCredits}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder={
                    transcribing
                      ? 'Writing down what you said…'
                      : outOfCredits
                        ? 'No assistant credits left this month'
                        : 'Ask, or say what to do'
                  }
                  className="min-h-11 flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-[14px] leading-snug text-ink placeholder:text-ink-faint focus:border-accent-ai focus:outline-none disabled:opacity-60"
                />
                </>
              )}
              {canListen && !draftText.trim() && (!busy || listening) && (
                <button
                  type="button"
                  title="Hold to talk"
                  aria-pressed={!!listening}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    void pressMic(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => moveMic(e.clientX, e.clientY)}
                  onPointerUp={() => releaseMic()}
                  onPointerCancel={() => releaseMic(true)}
                  onKeyDown={(e) => {
                    if (e.key !== ' ' && e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!e.repeat) void pressMic(0, 0);
                  }}
                  onKeyUp={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') releaseMic();
                  }}
                  onClick={() => {
                    // Screen readers and switch access send a click with no press:
                    // listen until Done.
                    if (pressed.current) {
                      pressed.current = false;
                      return;
                    }
                    void beginListening().then((l) => l && setHandsFree(true));
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={transcribing || !caps || outOfCredits}
                  className={`grid size-11 shrink-0 cursor-pointer touch-none place-items-center rounded-lg border transition-[transform,background-color,border-color] select-none [-webkit-touch-callout:none] disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none ${
                    listening
                      ? armedCancel
                        ? 'scale-110 border-accent-danger bg-accent-danger text-white'
                        : 'scale-110 border-accent-ai bg-accent-ai text-white'
                      : 'border-accent-ai-edge bg-accent-ai-tint text-accent-ai hover:border-accent-ai'
                  }`}
                >
                  {transcribing ? (
                    <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Mic className="size-5" aria-hidden />
                  )}
                  <span className="sr-only">Hold to talk</span>
                </button>
              )}
              {listening ? null : busy ? (
                <Button type="button" size="icon-lg" variant="outline" onClick={stop}>
                  <Square className="size-4 fill-current" aria-hidden />
                  <span className="sr-only">Stop answering</span>
                </Button>
              ) : (
                (draftText.trim() || !canListen) && (
                  <Button type="submit" size="icon-lg" variant="primary" disabled={!draftText.trim() || !caps}>
                    <ArrowUp className="size-5" aria-hidden />
                    <span className="sr-only">Send</span>
                  </Button>
                )
              )}
            </form>
          )}
          <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
            Answers come from your school&apos;s records and can still be wrong. Check before acting on them.
          </p>
        </div>
      </section>
    </>
  );
}
