"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { mutate } from "swr";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PULL TO REFRESH — the ledger rule

   Pulling down at the top of a page draws a ledger rule across it, a brass
   nib riding the line to show how far there is to go. Let go past the
   threshold and the rule runs the same brass sheen the skeletons use while
   fresh data is fetched, inks solid for a beat, and retracts.

   What "refresh" means here:
     - every SWR key in the cache is revalidated (`mutate(() => true)`), so
       any page built on useSWR updates with no wiring at all;
     - pages that fetch with plain useEffect register their reload with
       `usePullToRefresh(fn)` — one line, see parent-dashboard/page.tsx;
     - the PWA's own staleness is dealt with: the service worker is asked to
       check for a new deployment (a waiting worker is promoted, and the
       Registrar reloads with fresh code), and the runtime caches are
       dropped so a stale page or asset can never be replayed. This is the
       "had to clear site data by hand" fix, on the gesture people already
       reach for when the app looks out of date.

   The gesture only engages when the window is scrolled to the very top, the
   pull is clearly vertical, and no scrollable ancestor (a modal body, a
   table) could still scroll up — otherwise the touch belongs to them.
   ═══════════════════════════════════════════════════════════════════════════ */

type Phase = "idle" | "pulling" | "armed" | "refreshing" | "settling";

/** Indicator travel (px) that arms a refresh. */
const THRESHOLD = 72;
/** The indicator never grows past this, however far the finger goes. */
const MAX_PULL = 118;
/** Finger-to-indicator ratio — the drag resists, like pulling paper. */
const RESISTANCE = 0.45;
/** The sheen must be visible long enough to read as "working", even when
    the network answers instantly. */
const MIN_HOLD_MS = 650;

type RefreshHandler = () => unknown | Promise<unknown>;

const handlers = new Set<RefreshHandler>();

/**
 * Register this page's reload with the pull-to-refresh gesture. The handler
 * always calls the latest render's closure, so it can safely reference state.
 * Pages built on useSWR don't need this — their keys revalidate globally.
 */
export function usePullToRefresh(handler: RefreshHandler) {
    const latest = useRef(handler);
    useEffect(() => {
        latest.current = handler;
    });
    useEffect(() => {
        const run: RefreshHandler = () => latest.current();
        handlers.add(run);
        return () => {
            handlers.delete(run);
        };
    }, []);
}

/** True if anything between the touch target and `stop` can still scroll up. */
function ancestorCanScrollUp(start: EventTarget | null, stop: HTMLElement): boolean {
    let el = start instanceof Element ? start : null;
    while (el && el !== stop) {
        if (el.scrollTop > 0) return true;
        el = el.parentElement;
    }
    return false;
}

/**
 * The PWA half of a refresh. Data comes back through SWR and the registered
 * handlers; this makes sure the APP itself is current too:
 *
 *   1. `reg.update()` re-fetches sw.js — the check that discovers a new
 *      deployment. If a new worker is (or becomes) waiting, SKIP_WAITING
 *      promotes it and ServiceWorkerRegistrar's controllerchange listener
 *      reloads the app on fresh code.
 *   2. Every runtime cache is dropped. The worker's fetch handlers repopulate
 *      them lazily, so the only cost is a network round-trip on the next
 *      navigation — and the payoff is that a stale page or icon can never be
 *      replayed after a person has explicitly asked for fresh.
 *
 * Both are best-effort: offline or unsupported, the data refresh still runs.
 */
async function refreshPwaCaches(): Promise<void> {
    if ("serviceWorker" in navigator) {
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                await reg.update().catch(() => { /* offline — nothing new to find */ });
                reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
        } catch { /* no registration — nothing to update */ }
    }
    if ("caches" in window) {
        try {
            const names = await caches.keys();
            await Promise.all(names.map((name) => caches.delete(name)));
        } catch { /* Caches API unavailable — nothing to clear */ }
    }
}

const CAPTIONS: Record<Exclude<Phase, "idle">, string> = {
    pulling: "Pull to refresh",
    armed: "Release to refresh",
    refreshing: "Refreshing…",
    settling: "Up to date",
};

export default function PullToRefresh({ children }: { children: ReactNode }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const zoneRef = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<Phase>("idle");
    const phaseRef = useRef(phase);
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    // Gesture state lives in a ref — touchmove runs at frame rate and must
    // not re-render; only phase changes go through React.
    const gesture = useRef({ startY: 0, startX: 0, dist: 0, active: false, captured: false });

    // Height and progress are written straight to the DOM for the same reason.
    const render = useCallback((dist: number, animate: boolean) => {
        const zone = zoneRef.current;
        if (!zone) return;
        zone.style.transition = animate ? "height 0.32s var(--ease-out-ink)" : "none";
        zone.style.height = `${dist}px`;
        zone.style.setProperty("--ptr-p", String(Math.min(1, dist / THRESHOLD)));
    }, []);

    const refresh = useCallback(async () => {
        setPhase("refreshing");
        render(THRESHOLD, true);
        const hold = new Promise((r) => setTimeout(r, MIN_HOLD_MS));
        await Promise.allSettled([
            ...[...handlers].map((h) => Promise.resolve().then(h)),
            mutate(() => true),
            refreshPwaCaches(),
        ]);
        await hold;
        setPhase("settling");
        // Let the solid ink read before the rule retracts.
        window.setTimeout(() => {
            render(0, true);
            window.setTimeout(() => setPhase("idle"), 320);
        }, 380);
    }, [render]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;

        const onStart = (e: TouchEvent) => {
            const p = phaseRef.current;
            if (p === "refreshing" || p === "settling") return;
            if (e.touches.length !== 1) return;
            if (window.scrollY > 0) return;
            if (ancestorCanScrollUp(e.target, el)) return;
            gesture.current = {
                startY: e.touches[0].clientY,
                startX: e.touches[0].clientX,
                dist: 0,
                active: true,
                captured: false,
            };
        };

        const onMove = (e: TouchEvent) => {
            const g = gesture.current;
            if (!g.active) return;
            const dy = e.touches[0].clientY - g.startY;
            const dx = e.touches[0].clientX - g.startX;
            if (!g.captured) {
                if (dy < 0 || Math.abs(dx) > dy) {
                    // Scrolling up, or a horizontal swipe — not ours.
                    g.active = false;
                    return;
                }
                if (dy < 8) return; // not yet clearly a pull
                if (window.scrollY > 0) {
                    g.active = false;
                    return;
                }
                g.captured = true;
                setPhase("pulling");
            }
            // From here the gesture is ours — stop the page rubber-banding.
            e.preventDefault();
            const dist = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
            g.dist = dist;
            render(dist, false);
            const next: Phase = dist >= THRESHOLD ? "armed" : "pulling";
            if (phaseRef.current !== next) setPhase(next);
        };

        const onEnd = () => {
            const g = gesture.current;
            const wasCaptured = g.active && g.captured;
            g.active = false;
            if (!wasCaptured) return;
            if (g.dist >= THRESHOLD) {
                void refresh();
            } else {
                setPhase("idle");
                render(0, true);
            }
        };

        // touchmove must be non-passive for preventDefault to work.
        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd);
        el.addEventListener("touchcancel", onEnd);
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, [render, refresh]);

    // While this component is mounted, the browser's own pull-to-refresh
    // (Chrome on Android) must stand down or both would fire on one pull.
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = html.style.overscrollBehaviorY;
        const prevBody = body.style.overscrollBehaviorY;
        html.style.overscrollBehaviorY = "contain";
        body.style.overscrollBehaviorY = "contain";
        return () => {
            html.style.overscrollBehaviorY = prevHtml;
            body.style.overscrollBehaviorY = prevBody;
        };
    }, []);

    return (
        <div ref={wrapRef}>
            <div ref={zoneRef} className="ptr-zone" style={{ height: 0 }}>
                <div className="ptr-inner" data-phase={phase} aria-hidden={phase === "idle"}>
                    <div className="ptr-track">
                        <span className="ptr-line" />
                        <span className="ptr-nib" />
                    </div>
                    <p
                        role="status"
                        aria-live="polite"
                        className={cn(
                            "font-mono text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors duration-200",
                            phase === "pulling" && "text-ink-faint",
                            (phase === "armed" || phase === "refreshing") && "text-brass-500",
                            phase === "settling" && "text-ink-muted",
                        )}
                    >
                        {phase === "idle" ? "" : CAPTIONS[phase]}
                    </p>
                </div>
            </div>
            {children}
        </div>
    );
}
