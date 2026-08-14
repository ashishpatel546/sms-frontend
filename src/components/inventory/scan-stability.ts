/**
 * The stable-decode gate for the counter scanner.
 *
 * Printed inventory labels come many-to-a-sheet, so a camera pointed near one
 * label can briefly decode its neighbour first. Accepting on the first frame
 * (as `PickupScanner` does — it only ever scans one item at a time) would add
 * the wrong item to a cart. Instead a value must repeat for `stableFrames`
 * consecutive decodes AND for at least `stableMs`, before it is accepted.
 *
 * Pure and stateless-per-call so it is testable without a camera — the React
 * component owns the state and calls this on every decode callback.
 */

export interface ScanStabilityState {
  value: string | null;
  count: number;
  firstAt: number;
  lastAcceptedValue: string | null;
  lastAcceptedAt: number;
}

export const INITIAL_SCAN_STABILITY_STATE: ScanStabilityState = {
  value: null,
  count: 0,
  firstAt: 0,
  lastAcceptedValue: null,
  lastAcceptedAt: 0,
};

export interface ScanStabilityConfig {
  /** Minimum time the same value must keep decoding before it's accepted. */
  stableMs: number;
  /** Minimum consecutive decodes of the same value before it's accepted. */
  stableFrames: number;
  /** After accepting a value, ignore that same value for this long — a
   *  deliberate re-scan of the same label (e.g. "add another") still works
   *  because it only suppresses the EXACT value that was just accepted. */
  cooldownMs: number;
}

export const DEFAULT_SCAN_STABILITY_CONFIG: ScanStabilityConfig = {
  stableMs: 400,
  stableFrames: 3,
  cooldownMs: 2000,
};

export type ScanStabilityResult =
  | { state: ScanStabilityState; accepted: false }
  | { state: ScanStabilityState; accepted: true; value: string };

export function nextScanState(
  state: ScanStabilityState,
  decodedValue: string,
  now: number,
  config: ScanStabilityConfig = DEFAULT_SCAN_STABILITY_CONFIG,
): ScanStabilityResult {
  if (
    state.lastAcceptedValue === decodedValue &&
    now - state.lastAcceptedAt < config.cooldownMs
  ) {
    return { state, accepted: false };
  }

  const tracking =
    state.value === decodedValue
      ? { value: decodedValue, count: state.count + 1, firstAt: state.firstAt }
      : { value: decodedValue, count: 1, firstAt: now };

  const stable =
    tracking.count >= config.stableFrames && now - tracking.firstAt >= config.stableMs;

  if (!stable) {
    return {
      state: { ...state, ...tracking },
      accepted: false,
    };
  }

  return {
    state: {
      value: null,
      count: 0,
      firstAt: 0,
      lastAcceptedValue: decodedValue,
      lastAcceptedAt: now,
    },
    accepted: true,
    value: decodedValue,
  };
}
