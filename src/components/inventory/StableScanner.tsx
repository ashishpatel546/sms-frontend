'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import {
  DEFAULT_SCAN_STABILITY_CONFIG,
  INITIAL_SCAN_STABILITY_STATE,
  nextScanState,
  type ScanStabilityConfig,
} from './scan-stability';

/**
 * Camera scanner for the inventory counter — QR and 1-D barcodes, with a
 * stability gate so a sheet of adjacent printed labels can't hand back the
 * wrong item. Reuses `PickupScanner`'s html5-qrcode plumbing (permission
 * dance, back-camera pick, fps/qrbox sizing) but is a separate component:
 * PickupScanner accepts on the first decode by design (it only ever scans
 * one thing at a time), which is exactly the behaviour this screen must not
 * have.
 */
export interface StableScannerProps {
  onCode: (code: string) => void;
  /** QR by default, plus the two 1-D formats item barcodes come in. */
  formats?: string[];
  config?: Partial<ScanStabilityConfig>;
  onClose?: () => void;
}

type CameraState = 'idle' | 'requesting' | 'scanning' | 'error';

/** html5-qrcode's own state enum; only NOT_STARTED means "safe to discard". */
const NOT_STARTED = 1;

/** How long to wait for the camera before admitting it isn't coming. */
const START_TIMEOUT_MS = 15_000;

/** How long a cancel waits for an in-flight start before abandoning it. */
const TEARDOWN_WAIT_MS = 3_000;

/**
 * html5-qrcode calls `video.play()` without ever attaching a rejection
 * handler, so any interruption — cancelling while the camera is still
 * negotiating, the element leaving the DOM — surfaces as an unhandled
 * AbortError in the dev overlay. While a scanner is starting, wrap `play` so
 * every returned promise carries a no-op catch: the promise still resolves or
 * rejects identically for the library, it just can never be *unhandled*.
 * Refcounted so overlapping scanners don't fight over the prototype.
 */
let playPatchCount = 0;
let originalPlay: (typeof HTMLVideoElement.prototype)['play'] | null = null;

function acquirePlayPatch() {
  if (typeof HTMLVideoElement === 'undefined') return;
  if (playPatchCount === 0) {
    originalPlay = HTMLVideoElement.prototype.play;
    HTMLVideoElement.prototype.play = function patchedPlay(this: HTMLVideoElement) {
      const promise = originalPlay!.call(this);
      promise.catch(() => {});
      return promise;
    };
  }
  playPatchCount += 1;
}

function releasePlayPatch() {
  playPatchCount = Math.max(0, playPatchCount - 1);
  if (playPatchCount === 0 && originalPlay) {
    HTMLVideoElement.prototype.play = originalPlay;
    originalPlay = null;
  }
}

/** The subset of Html5Qrcode's instance surface this component calls. */
interface Html5QrcodeInstance {
  start: (
    cameraIdOrConfig: string | { deviceId: { exact: string } },
    config: {
      fps: number;
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number };
      aspectRatio?: number;
      experimentalFeatures?: { useBarCodeDetectorIfSupported?: boolean };
    },
    onSuccess: (decodedText: string) => void,
    onError: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  getState: () => number;
}

/**
 * html5-qrcode sizes its `<video>` from `parentElement.clientWidth` *once*, at
 * creation. Called a frame too early that is `0`, and it writes `width: 0px`
 * onto the video — a scanner that is running perfectly and shows nothing at
 * all. So wait for the element to actually have a width before starting.
 */
async function waitForLayoutWidth(el: HTMLElement, frames = 30): Promise<number> {
  for (let i = 0; i < frames; i += 1) {
    if (el.clientWidth > 0) return el.clientWidth;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
  return el.clientWidth;
}

/**
 * The decoder is ~380 KB, so it stays out of the main bundle and is fetched on
 * the first scan. That makes starting the camera depend on a network request,
 * and a single dropped chunk — a flaky tunnel, or a dev server that rebuilt
 * while the page sat open — should not read as a broken scanner. One retry
 * covers the transient case; a second failure is worth telling the user about.
 */
async function loadScannerLib(): Promise<typeof import('html5-qrcode')> {
  try {
    return await import('html5-qrcode');
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return import('html5-qrcode');
  }
}

/**
 * Say what actually went wrong. Every failure used to be reported as "close
 * any other app using the camera", which is useless advice when the real
 * problem is a chunk that failed to download or a permission that was denied.
 */
function describeScannerError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err ?? '');

  if (name === 'ChunkLoadError' || /Failed to load chunk|Loading chunk|dynamically imported module/i.test(message)) {
    return 'Could not download the scanner. Check your connection and reload the page.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera access was denied. Allow the camera for this page in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'No usable camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is being used by another app. Close it (Teams, Zoom, the Camera app) and try again.';
  }
  if (/did not start in time/i.test(message)) {
    return 'The camera did not start in time. Close any other app using it, then try again.';
  }
  return message || 'Failed to start the scanner. Reload the page and try again.';
}

export default function StableScanner({ onCode, config, onClose }: StableScannerProps) {
  const [state, setState] = useState<CameraState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // html5-qrcode mounts into an element found by id, so a hard-coded one would
  // make two scanners on the same screen (say the catalogue's search scan and
  // a dialog's barcode scan) fight over the same node.
  const readerId = `inventory-qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const readerRef = useRef<HTMLDivElement | null>(null);
  const html5QrScannerRef = useRef<Html5QrcodeInstance | null>(null);
  /** The in-flight `start()`, so a teardown can wait for it to settle. */
  const startPromiseRef = useRef<Promise<unknown> | null>(null);
  const stabilityRef = useRef(INITIAL_SCAN_STABILITY_STATE);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stabilityConfig = { ...DEFAULT_SCAN_STABILITY_CONFIG, ...config };

  /**
   * Shut the camera down without ever throwing.
   *
   * html5-qrcode keeps a state machine and refuses to begin a second
   * transition while one is running, so cancelling during a slow camera start
   * threw "Cannot transition to a new state, already under transition" — and
   * tearing the video out mid-`play()` raised an unhandled AbortError on top.
   * Waiting for the start to settle first makes cancel safe at any moment.
   */
  const teardown = useCallback(async () => {
    const scanner = html5QrScannerRef.current;
    const pendingStart = startPromiseRef.current;
    html5QrScannerRef.current = null;
    startPromiseRef.current = null;
    if (!scanner) return;

    const stopIfRunning = async () => {
      // html5-qrcode installs `onabort`/`onerror` handlers on its <video>
      // that do nothing but THROW — and its own close() then removes that
      // video, which queues an abort event, which lands as an uncaught error
      // in the dev overlay. The handlers are pure never-happens assertions;
      // clear them before asking the library to tear its element down.
      const video = document.getElementById(readerId)?.querySelector('video');
      if (video) {
        video.onabort = null;
        video.onerror = null;
      }
      try {
        if (scanner.getState() !== NOT_STARTED) await scanner.stop();
      } catch {
        /* never started, or already stopped — either way there is nothing to do */
      }
    };

    if (pendingStart) {
      // Wait for the in-flight start — but not forever. A camera stuck in
      // driver negotiation can hold this promise open for many seconds, and
      // an earlier version awaited it unboundedly: cancel hung, no error was
      // ever shown, and the start timeout's own cleanup deadlocked on the
      // same await.
      let settled = false;
      const mark = () => {
        settled = true;
      };
      await Promise.race([
        pendingStart.then(mark, mark),
        new Promise((resolve) => setTimeout(resolve, TEARDOWN_WAIT_MS)),
      ]);
      if (!settled) {
        // Abandon the wait, but not the camera: whenever the stuck start
        // finally settles, shut the scanner straight back down so the
        // camera LED doesn't stay lit behind a UI that has moved on.
        pendingStart.then(
          () => void stopIfRunning(),
          () => void stopIfRunning(),
        );
        return;
      }
    }
    await stopIfRunning();
  }, [readerId]);

  const start = async () => {
    if (typeof window === 'undefined') return;
    setState('requesting');

    // Asking for the camera twice in a row is the problem, not the solution:
    // on Windows a device is often exclusive, and re-acquiring it before the
    // OS has released the first grab is a good way to hang. So only do the
    // permission dance when permission is not already settled.
    let permissionGranted = false;
    try {
      const status = await navigator.permissions?.query({
        name: 'camera' as PermissionName,
      });
      permissionGranted = status?.state === 'granted';
    } catch {
      /* Firefox and Safari don't expose the camera permission — ask below. */
    }

    if (!permissionGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        stream.getTracks().forEach((t) => t.stop());
        // Give the OS a moment to actually release the device before the
        // library grabs it again.
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        setErrorMsg(describeScannerError(err));
        setState('error');
        return;
      }
    }

    setState('scanning');
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await loadScannerLib();
      await teardown();

      // getCameras() briefly opens the camera to read device labels (that is
      // the first blink of the LED). Give the OS a beat to release it before
      // the real acquisition — Windows camera drivers dislike back-to-back
      // open/close cycles on the same device.
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setErrorMsg('No camera found on this device.');
        setState('error');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      const backCam =
        cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[cameras.length - 1];

      // The viewport only exists once React has painted the scanning state,
      // and only has a width once it has been laid out.
      const readerEl = readerRef.current;
      if (!readerEl) {
        setErrorMsg('Scanner viewport was not ready. Try again.');
        setState('error');
        return;
      }
      await waitForLayoutWidth(readerEl);

      const scanner = new Html5Qrcode(readerId, {
        verbose: false,
        // QR for our own labels; the rest are what merchandise actually
        // arrives printed with — ISBN/EAN on books, UPC on imported stock,
        // CODE_39/ITF on cartons from local suppliers.
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
      });
      html5QrScannerRef.current = scanner as unknown as Html5QrcodeInstance;

      acquirePlayPatch();
      const startPromise = (scanner as unknown as Html5QrcodeInstance).start(
        // Exactly one key, and only `deviceId` or `facingMode` — html5-qrcode
        // validates this argument itself and throws on anything else. And no
        // resolution request ANYWHERE at acquisition time: measured on real
        // hardware, this laptop's camera answers a bare deviceId in ~0.7 s
        // but hangs 6+ s in driver renegotiation when 1080p is asked for up
        // front — camera LED on, no video element, no preview, no error.
        // Resolution is raised on the live track afterwards instead.
        { deviceId: { exact: backCam.id } },
        {
          fps: 10,
          // A function, not fixed numbers: the box is measured against the
          // real viewfinder, so it can never exceed it (which silently
          // disables the scan region) whatever size the container turns out
          // to be. Wide and short, because a square box crops a 1-D barcode
          // — the reason a webcam that reads QR instantly appears unable to
          // read a book's barcode at all.
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.max(50, Math.floor(viewfinderWidth * 0.9));
            const height = Math.max(50, Math.floor(Math.min(viewfinderHeight * 0.7, width * 0.62)));
            return { width, height };
          },
          // Chrome/Edge ship a native BarcodeDetector that is dramatically
          // better at 1-D than the JS decoder — on Android. Windows has no
          // implementation at all, so this quietly does nothing there.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        (decodedText: string) => {
          const now = Date.now();
          const result = nextScanState(stabilityRef.current, decodedText, now, stabilityConfig);
          stabilityRef.current = result.state;
          if (result.accepted) {
            if (navigator.vibrate) navigator.vibrate(60);
            onCodeRef.current(result.value);
          }
        },
        () => {
          /* per-frame decode miss — keep scanning */
        },
      );
      startPromiseRef.current = startPromise;
      // The patch must stay active until the library's play() has actually
      // been called — which happens just before startPromise settles, however
      // long the camera takes — not merely until this function returns.
      startPromise.then(releasePlayPatch, releasePlayPatch);

      // A camera that never opens used to leave a blank rectangle and no
      // explanation. Say so instead, and leave the retry within reach.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The camera did not start in time.')),
          START_TIMEOUT_MS,
        );
      });
      try {
        await Promise.race([startPromise, timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      // Deliberately NO resolution request — not at acquisition, not as a
      // background `applyConstraints` bump afterwards. Both were tried
      // against real hardware and both stall this class of Windows camera
      // driver: up-front 1080p hangs getUserMedia for 6+ seconds, and a
      // live-track bump left the element at readyState 4 with currentTime
      // frozen at 0 — "playing", delivering nothing. The camera's native
      // default plus the wide scan box is enough for EAN-13 (~6 px per
      // module when the code fills the box), and phones — where most real
      // scanning happens — default to 720p+ with the native BarcodeDetector
      // on top. A frozen preview costs the feature; sharper frames only
      // flatter it.
    } catch (err) {
      console.error('Inventory scanner init error', err);
      await teardown();
      setErrorMsg(describeScannerError(err));
      setState('error');
    }
  };

  const stop = async () => {
    await teardown();
    setState('idle');
  };

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={start}
        className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface-secondary text-ink-muted transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
      >
        <Camera className="size-6" aria-hidden />
        <span className="text-[13.5px] font-semibold">Tap to scan a QR or barcode</span>
      </button>
    );
  }

  if (state === 'requesting') {
    return (
      <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-secondary">
        <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <span className="text-[12.5px] text-ink-muted">Requesting camera access…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-accent-danger-edge bg-accent-danger-tint p-4 text-center">
        <p className="text-[13px] font-medium text-accent-danger-deep">{errorMsg}</p>
        <button
          type="button"
          onClick={start}
          className="text-[12.5px] font-semibold text-brand underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-muted">
          Hold steady on one label — it accepts once the same code reads consistently.
          For a printed barcode, fill the box edge to edge and hold ~15 cm away.
        </span>
        <button
          type="button"
          onClick={() => {
            void stop().then(() => onClose?.());
          }}
          className="shrink-0 rounded-full p-1 text-ink-faint hover:bg-surface-secondary hover:text-ink"
          aria-label="Stop scanning"
        >
          <X className="size-4" />
        </button>
      </div>
      {/* The `[&_video]` rules are not cosmetic: html5-qrcode writes a fixed
          pixel width onto the <video> from the container's width at the moment
          it is created, which leaves the preview mis-sized — or invisible, at
          `0px` — if layout was not settled. Overriding it keeps the preview
          correct however that measurement landed. */}
      <div
        id={readerId}
        ref={readerRef}
        className="min-h-40 w-full overflow-hidden rounded-xl border border-line bg-black/5 [&_video]:h-auto! [&_video]:w-full! [&_video]:max-w-full!"
      />
    </div>
  );
}
