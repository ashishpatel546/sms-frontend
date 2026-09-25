'use client';

import { AssistantError, speak as serverSpeak, transcribe } from './client';

/**
 * Voice in and out, with two routes each:
 *
 *   server  — audio recorded here, transcribed / synthesised by sms-agent
 *             (metered against the school's credits);
 *   device  — the browser's own speech recognition and speech synthesis
 *             (free).
 *
 * The school's hub setting picks which route comes first; the other is the
 * fallback — e.g. device first, and sms-agent's model on a device that
 * cannot listen or has no voice for the language.
 */

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function canRecogniseOnDevice(): boolean {
  return recognitionCtor() !== null;
}

export function canSpeakOnDevice(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickMime(): string | undefined {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

export interface Listening {
  /** Finish and get the words. */
  stop(): Promise<string>;
  /** Throw away what was said. */
  cancel(): void;
}

function micError(err: unknown): AssistantError {
  const name = (err as { name?: string; error?: string })?.name ?? (err as { error?: string })?.error;
  // The browser's recognition service itself failed (not the microphone):
  // server transcription can still work.
  if (name === 'service-not-allowed' || name === 'network' || name === 'language-not-supported') {
    return new AssistantError('DEVICE_STT_FAILED', "This device's voice input isn't working.");
  }
  if (name === 'NotAllowedError' || name === 'not-allowed') {
    return new AssistantError(
      'MIC_BLOCKED',
      'Microphone access is blocked. Allow it in the browser settings for this site.',
    );
  }
  if (name === 'NotFoundError') {
    return new AssistantError('NO_MIC', 'No microphone found on this device.');
  }
  return new AssistantError('MIC_FAILED', "Couldn't start the microphone. Try again.");
}

/** Records audio and sends it to the server when stopped. */
async function listenOnServer(maxSeconds: number, onAutoStop: () => void): Promise<Listening> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw micError(err);
  }
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const started = performance.now();
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start(250);
  const timer = window.setTimeout(onAutoStop, maxSeconds * 1000);

  const finish = () =>
    new Promise<Blob>((resolve) => {
      window.clearTimeout(timer);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else recorder.onstop?.(new Event('stop'));
    });

  return {
    async stop() {
      const blob = await finish();
      const ms = performance.now() - started;
      if (ms < 400 || blob.size < 1000) return '';
      return transcribe(blob, ms);
    },
    cancel() {
      void finish();
    },
  };
}

/** Browser speech recognition (Chrome, Edge, Safari). */
function listenOnDevice(lang: string): Listening {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    throw new AssistantError('NO_VOICE', 'Voice input is not supported in this browser. Type instead.');
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  let text = '';
  let failure: AssistantError | null = null;
  let ended = false;
  let resolveEnd: () => void = () => undefined;
  const endPromise = new Promise<void>((r) => {
    resolveEnd = r;
  });
  rec.onresult = (e) => {
    text = Array.from(e.results)
      .map((r) => r[0]?.transcript ?? '')
      .join(' ')
      .trim();
  };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') failure = micError(e);
  };
  rec.onend = () => {
    ended = true;
    resolveEnd();
  };
  try {
    rec.start();
  } catch (err) {
    throw micError(err);
  }
  return {
    async stop() {
      if (!ended) rec.stop();
      await endPromise;
      if (failure) throw failure;
      return text;
    },
    cancel() {
      rec.abort();
    },
  };
}

export async function startListening(opts: {
  server: boolean;
  maxSeconds: number;
  lang?: string;
  onAutoStop: () => void;
}): Promise<Listening> {
  if (opts.server && canRecord()) return listenOnServer(opts.maxSeconds, opts.onAutoStop);
  return listenOnDevice(opts.lang ?? 'en-IN');
}

// ── Speaking replies ────────────────────────────────────────────────────────

/** Markdown reads badly aloud: speak the plain gist. */
export function speakableText(text: string, max = 600): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/[*_#`>|]+/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
  return stop > max / 3 ? cut.slice(0, stop + 1) : cut;
}

/** Whether the device has a voice for this language ("hi-IN", "en-IN"). */
function deviceHasVoice(lang: string): boolean {
  if (!canSpeakOnDevice()) return false;
  const prefix = lang.slice(0, 2).toLowerCase();
  return window.speechSynthesis
    .getVoices()
    .some((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
}

export class Speaker {
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private serverFailed = false;
  private prefer: 'device' | 'server' = 'device';
  private server = false;

  /**
   * prefer: the school's choice. server: whether sms-agent can speak (the
   * choice itself, or the fallback for a device without a voice).
   */
  configure(prefer: 'device' | 'server', server: boolean) {
    this.prefer = prefer;
    this.server = server;
    // Browsers load their voice list lazily; ask early so it is ready.
    if (canSpeakOnDevice()) window.speechSynthesis.getVoices();
  }

  async say(text: string, onEnd?: () => void): Promise<void> {
    this.stop();
    const line = speakableText(text);
    if (!line) return;
    const lang = /[ऀ-ॿ]/.test(line) ? 'hi-IN' : 'en-IN';
    const useServer =
      this.server &&
      !this.serverFailed &&
      (this.prefer === 'server' || !deviceHasVoice(lang));
    if (useServer) {
      try {
        this.abort = new AbortController();
        const blob = await serverSpeak(line, this.abort.signal);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.audio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          onEnd?.();
        };
        await audio.play();
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (err instanceof AssistantError && err.code === 'VOICE_UNAVAILABLE') {
          this.serverFailed = true;
        }
        // fall through to the device voice
      }
    }
    if (!canSpeakOnDevice()) return;
    const u = new SpeechSynthesisUtterance(line);
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang);
    if (voice) u.voice = voice;
    u.onend = () => onEnd?.();
    window.speechSynthesis.speak(u);
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (canSpeakOnDevice()) window.speechSynthesis.cancel();
  }
}
