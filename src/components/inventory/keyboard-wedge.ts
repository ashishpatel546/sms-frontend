/**
 * Detects an external USB/Bluetooth barcode scanner acting as a keyboard
 * ("keyboard wedge"). Such scanners type each character of a code in rapid
 * succession — far faster than a human — and finish with Enter.
 *
 * The signature that distinguishes it from a person typing into a text field
 * is timing: consecutive characters land under `maxGapMs` apart. Anything
 * slower resets the buffer, so ordinary typing (including in a focused input)
 * never gets mistaken for a scan.
 *
 * Pure and stateless-per-call, same reasoning as `scan-stability.ts` — the
 * component wires this to a capture-phase `keydown` listener.
 */

export interface WedgeState {
  buffer: string;
  lastCharAt: number;
}

export const INITIAL_WEDGE_STATE: WedgeState = { buffer: '', lastCharAt: 0 };

export interface WedgeConfig {
  /** Max gap between characters that still counts as one machine-typed burst. */
  maxGapMs: number;
  /** Shortest buffer, terminated by Enter, that counts as a scan. */
  minLength: number;
}

export const DEFAULT_WEDGE_CONFIG: WedgeConfig = { maxGapMs: 50, minLength: 4 };

export interface WedgeEvent {
  key: string;
  now: number;
}

export type WedgeResult =
  | { state: WedgeState; emit: false }
  | { state: WedgeState; emit: true; value: string };

export function nextWedgeState(
  state: WedgeState,
  event: WedgeEvent,
  config: WedgeConfig = DEFAULT_WEDGE_CONFIG,
): WedgeResult {
  const gap = event.now - state.lastCharAt;
  const buffer = state.buffer === '' || gap > config.maxGapMs ? '' : state.buffer;

  if (event.key === 'Enter') {
    const reset = { buffer: '', lastCharAt: event.now };
    if (buffer.length >= config.minLength) {
      return { state: reset, emit: true, value: buffer };
    }
    return { state: reset, emit: false };
  }

  // Non-printable, non-Enter keys (Shift, Tab, arrows...) don't extend the
  // buffer and don't reset the timing — a modifier held mid-burst must not
  // look like a pause.
  if (event.key.length !== 1) {
    return { state, emit: false };
  }

  return { state: { buffer: buffer + event.key, lastCharAt: event.now }, emit: false };
}
