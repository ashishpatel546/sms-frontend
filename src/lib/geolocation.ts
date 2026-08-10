/**
 * Acquiring a location fix precise enough to prove where somebody is standing.
 *
 * `getCurrentPosition` is the wrong tool for attendance, for a reason that is
 * easy to miss: when GPS cannot lock, the browser does not fail. It quietly
 * falls back to the network or IP provider and **resolves successfully** with a
 * position that can be kilometres out, carrying the same apparent precision as
 * a satellite fix. `enableHighAccuracy: true` is only a hint and does not
 * change this. The single call also tends to fire on whichever source answers
 * first, which is usually the coarse one — the GPS fix typically lands two to
 * five seconds later, by which time the promise has already settled.
 *
 * So this module watches instead of asking once: it keeps the best fix seen,
 * returns early the moment one is good enough, and reports progress so the UI
 * can show precision tightening rather than spinning. What it will not do is
 * hand back a coarse fix and let the caller pretend otherwise — every fix
 * carries its `accuracy`, and the check-in path is required to send it on.
 */

export interface PreciseFix {
  lat: number;
  lng: number;
  /** Radius of the 95%-confidence circle, in metres. */
  accuracy: number;
  /** How long acquisition took, for the "still refining…" copy. */
  elapsedMs: number;
}

export type FixFailureCode =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'TOO_COARSE';

export class GeolocationFixError extends Error {
  readonly code: FixFailureCode;
  /** Best accuracy reached before giving up, when there was one at all. */
  readonly accuracy?: number;

  constructor(code: FixFailureCode, message: string, accuracy?: number) {
    super(message);
    this.name = "GeolocationFixError";
    this.code = code;
    this.accuracy = accuracy;
  }
}

export interface AcquireFixOptions {
  /** Stop refining once the fix is at least this good. */
  targetAccuracyM?: number;
  /** Stop refining after this long and use the best fix so far. */
  maxWaitMs?: number;
  /**
   * Refuse to return anything worse than this.
   *
   * A backstop, not the real boundary check — the client has no idea what shape
   * the school's zone is, so the server decides. This only spares the user a
   * biometric prompt and a round trip for a fix no campus zone could ever
   * accept, which is exactly the IP-derived case.
   */
  maxAcceptableM?: number;
  onProgress?: (progress: { accuracy: number; elapsedMs: number }) => void;
  signal?: AbortSignal;
}

/** Good enough for any realistic campus boundary, and reachable outdoors. */
export const DEFAULT_TARGET_ACCURACY_M = 20;
const DEFAULT_MAX_WAIT_MS = 20_000;
const DEFAULT_MAX_ACCEPTABLE_M = 500;

/** How the accuracy figure should read to somebody standing outside. */
export function describeAccuracy(accuracy: number): string {
  return accuracy >= 1000
    ? `±${(accuracy / 1000).toFixed(1)}km`
    : `±${Math.round(accuracy)}m`;
}

/**
 * Plain-language cause and remedy for a failed acquisition. Kept beside the
 * error codes so every caller says the same thing — and so none of them repeats
 * the old geofence's mistake of blaming the user's position for what was really
 * a bad fix.
 */
export function explainFixError(error: GeolocationFixError): string {
  switch (error.code) {
    case "UNSUPPORTED":
      return "This browser cannot provide a location. Try Chrome or Safari.";
    case "PERMISSION_DENIED":
      return "Location permission is blocked. Allow location for this site in your browser settings, then try again.";
    case "POSITION_UNAVAILABLE":
      return "Your device could not determine a location. Turn on Location/GPS in your phone settings and try again.";
    case "TIMEOUT":
      return "Could not get a location in time. Step outdoors, make sure GPS is on, and try again.";
    case "TOO_COARSE":
      return `Your location is only accurate to ${describeAccuracy(error.accuracy ?? 0)}, which usually means GPS is off and your phone is guessing from the network. Turn on Location/GPS, step outside if you are indoors, and try again.`;
  }
}

/** Maps the browser's positional error codes onto ours. */
function toFailureCode(error: GeolocationPositionError): FixFailureCode {
  if (error.code === error.PERMISSION_DENIED) return "PERMISSION_DENIED";
  if (error.code === error.TIMEOUT) return "TIMEOUT";
  return "POSITION_UNAVAILABLE";
}

/**
 * Watches the device's position, keeping the most precise fix seen, and
 * resolves as soon as one is good enough — or when the window closes, with the
 * best available.
 *
 * Rejects rather than returning something unusable: a caller that receives a
 * `PreciseFix` may rely on `accuracy` being no worse than `maxAcceptableM`.
 */
export function acquirePreciseFix(
  options: AcquireFixOptions = {},
): Promise<PreciseFix> {
  const {
    targetAccuracyM = DEFAULT_TARGET_ACCURACY_M,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    maxAcceptableM = DEFAULT_MAX_ACCEPTABLE_M,
    onProgress,
    signal,
  } = options;

  return new Promise<PreciseFix>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new GeolocationFixError(
          "UNSUPPORTED",
          "Geolocation is not available in this browser",
        ),
      );
      return;
    }

    const startedAt = Date.now();
    let best: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    const succeed = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        elapsedMs: Date.now() - startedAt,
      });
    };

    const fail = (error: GeolocationFixError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    function onAbort() {
      fail(new GeolocationFixError("TIMEOUT", "Location request cancelled"));
    }
    signal?.addEventListener("abort", onAbort);

    // Closing time: take the best fix we managed, provided it is usable at all.
    timer = setTimeout(() => {
      if (!best) {
        fail(
          new GeolocationFixError(
            "TIMEOUT",
            "No location fix within the time limit",
          ),
        );
        return;
      }
      if (best.coords.accuracy > maxAcceptableM) {
        fail(
          new GeolocationFixError(
            "TOO_COARSE",
            "Best available fix is too imprecise",
            best.coords.accuracy,
          ),
        );
        return;
      }
      succeed(best);
    }, maxWaitMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Keep the best, not the latest: sources interleave, and a fresh
        // network fix arriving after a good GPS one must not undo it.
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position;
        }
        onProgress?.({
          accuracy: best.coords.accuracy,
          elapsedMs: Date.now() - startedAt,
        });
        if (best.coords.accuracy <= targetAccuracyM) succeed(best);
      },
      (error) => {
        // A hard denial is final and no amount of waiting helps. Anything else
        // may still be followed by a good fix, so only give up if the window
        // closes with nothing better — hence no fail() here.
        if (error.code === error.PERMISSION_DENIED) {
          fail(new GeolocationFixError(toFailureCode(error), error.message));
        }
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 },
    );
  });
}
