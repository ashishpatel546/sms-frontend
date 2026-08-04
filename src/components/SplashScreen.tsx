"use client";
import Image from "next/image";
import { useSchoolInfoState } from "@/lib/useSchoolInfo";

import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  CalendarCheck2,
  FileText,
  IndianRupee,
  Users,
} from "lucide-react";

/**
 * The first thing anyone sees. It should say "this school", so it is walnut and
 * brass like the rest of the app rather than the generic navy/indigo it used to
 * be — that splash belonged to no product in particular.
 *
 * The stage is set once and stays set: the app's thesis line, a rotating line
 * of product copy, and the module chips are visible the whole time, on every
 * screen size. Only the tile and the name slot change with the story:
 *
 *   loading — the logo tile shimmers while the copy does the talking.
 *   reveal  — the school's logo and name join the stage (nothing is taken
 *             away); the fade countdown starts only after the logo has
 *             actually painted AND the minimum hold has passed.
 *   welcome — if the fetch fails, the school has no logo, or MAX_WAIT passes:
 *             a warm greeting in the product's voice, never an error.
 *
 * The old splash raced a hard 3s timer against a slow branding fetch, which is
 * why the logo "sometimes" appeared. Now the wait is bounded at MAX_WAIT, a
 * settled-but-empty fetch short-circuits straight to the welcome, and the
 * splash never leaves before MIN_SHOW_MS — it reads as a page, not a flash.
 */

const MIN_SHOW_MS = 4000; // the stage holds at least this long, logo or not —
// matched to the loader bar below, which runs 0→100% over the same span so
// the reader gets a consistent, unhurried beat regardless of the network.
const MAX_WAIT_MS = 8000; // give a cold API a real chance before giving up
const REVEAL_HOLD_MS = 2000; // extra time once the logo has painted — long
// enough for its slow fade-up to finish before the goodbye starts
const REVEAL_SAFETY_MS = 3000; // dismiss reveal even if the image never loads
const WELCOME_HOLD_MS = 1800;
const FADE_MS = 500;
const LINE_INTERVAL_MS = 2400;

/** What the app is, in the register's own voice — one line at a time. */
const PRODUCT_LINES = [
  "Attendance at the classroom door.",
  "Fees at the counter, receipts in hand.",
  "Mark sheets ready by the end of term.",
  "From the principal's desk to a parent's phone.",
];

/** The same quiet inventory the sign-in panel shows — what's inside. */
const MODULES = [
  { Icon: CalendarCheck2, label: "Attendance" },
  { Icon: IndianRupee, label: "Fees & receipts" },
  { Icon: FileText, label: "Examinations" },
  { Icon: BarChart2, label: "Reports" },
  { Icon: Users, label: "Parent portal" },
];

type Phase = "loading" | "reveal" | "welcome";

export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [show, setShow] = useState(true);
  const [holdDone, setHoldDone] = useState(false);
  const [minHoldDone, setMinHoldDone] = useState(false);
  // Ref so the dismissal effect never runs with a stale callback and never
  // re-arms its timer just because the parent re-rendered.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const [capReached, setCapReached] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [lineVisible, setLineVisible] = useState(true);
  const { info: schoolInfo, settled } = useSchoolInfoState();

  // ── The current act, derived rather than synced ────────────────────────────
  // A cached or fresh logo URL puts the school on stage; a fetch that settled
  // without one goes straight to the welcome (no pointless waiting). A timed-
  // out or broken logo is sticky: checking it first keeps a logo that arrives
  // late from yanking the welcome away mid-goodbye.
  const phase: Phase =
    logoFailed || capReached
      ? "welcome"
      : schoolInfo?.logoUrl
        ? "reveal"
        : settled
          ? "welcome" // school known but has no logo uploaded — greet by name
          : "loading";

  // Minimum time on stage, counted from mount.
  useEffect(() => {
    const t = setTimeout(() => setMinHoldDone(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  // Hard ceiling on the wait — after this, greet and get out of the way.
  useEffect(() => {
    if (phase !== "loading") return;
    const capTimer = setTimeout(() => setCapReached(true), MAX_WAIT_MS);
    return () => clearTimeout(capTimer);
  }, [phase]);

  // ── Rotating product line — keeps rotating for as long as it's on stage ────
  useEffect(() => {
    if (phase === "welcome") return;
    const interval = setInterval(() => {
      setLineVisible(false);
      setTimeout(() => {
        setLineIdx((i) => (i + 1) % PRODUCT_LINES.length);
        setLineVisible(true);
      }, 300);
    }, LINE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Dismissal — the act's own hold runs CONCURRENTLY with the minimum
  // hold (they overlap, not stack), and the goodbye starts when both are
  // done. Reveal: the hold starts once the logo has actually painted (with a
  // safety cap in case the S3 image itself stalls). Welcome: a fixed goodbye.
  useEffect(() => {
    if (phase === "loading") return;

    const delay =
      phase === "welcome"
        ? WELCOME_HOLD_MS
        : logoReady
          ? REVEAL_HOLD_MS
          : REVEAL_SAFETY_MS;

    const t = setTimeout(() => setHoldDone(true), delay);
    return () => clearTimeout(t);
  }, [phase, logoReady]);

  // The goodbye is derived, not synced: the overlay starts fading the moment
  // both holds are done, and leaves the DOM (handing off, if asked) after the
  // fade has played.
  const fade = holdDone && minHoldDone;

  useEffect(() => {
    if (!fade) return;
    const t = setTimeout(() => {
      setShow(false);
      onDoneRef.current?.();
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fade]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-label="Opening"
      className={`fixed inset-0 z-9999 flex flex-col items-center justify-center overflow-y-auto bg-walnut-950 px-4 py-10 transition-opacity duration-500 ease-in-out motion-reduce:transition-none ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* A brass bloom in the upper area, the same light the sidebar rail has —
          so the splash and the app behind it are lit from the same place. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 38%, rgba(169,103,12,0.30) 0%, transparent 62%)",
        }}
      />

      {/* The wordmark above the tile — whose product this is, stated once. */}
      <p className="tabular relative z-10 mb-6 text-center text-[10.5px] font-semibold tracking-[0.22em] text-brass-200/80 uppercase sm:text-[11px]">
        Colegios · School management
      </p>

      {/* Logo tile */}
      <div className="relative z-10 flex size-32 items-center justify-center rounded-2xl border border-brass-500/25 bg-white/6 p-5 shadow-2xl backdrop-blur-md sm:size-40 md:size-48">
        {/* `priority` — the logo is the LCP element (fullscreen, first paint),
            so it must load eagerly; lazy-loading it both delays the splash
            and trips Next's LCP warning in dev. */}
        {phase === "reveal" && schoolInfo?.logoUrl ? (
          <Image
            src={schoolInfo.logoUrl}
            alt=""
            width={256}
            height={256}
            className={`size-full object-contain drop-shadow-xl ${
              logoReady ? "splash-logo-in" : "opacity-0"
            }`}
            unoptimized
            priority
            onLoad={() => setLogoReady(true)}
            onError={() => setLogoFailed(true)}
          />
        ) : phase === "welcome" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/colegios/colegios-logo-v2.png"
            alt=""
            className="size-full rounded-xl object-cover drop-shadow-xl"
          />
        ) : (
          <div className="skeleton size-full rounded-xl" />
        )}
      </div>

      {/* The name slot: a proper greeting once we know the school, and a
          warm one even when we don't. Everything below stays put in every act. */}
      {phase === "reveal" && schoolInfo?.name && (
        <div className="relative z-10 mt-5 px-6 text-center">
          <p className="tabular text-[10px] font-semibold tracking-[0.2em] text-brass-300/90 uppercase">
            Welcome to
          </p>
          <p className="mt-1.5 font-display text-[18px] font-semibold text-paper-50 sm:text-[19px]">
            {schoolInfo.name}
          </p>
        </div>
      )}

      {phase === "welcome" && (
        <p className="relative z-10 mt-5 max-w-md px-6 text-center font-display text-[18px] leading-snug font-semibold text-paper-50 sm:text-[20px]">
          {schoolInfo?.name ? (
            <>
              Welcome to the digital campus of{" "}
              <span className="text-marigold-300">{schoolInfo.name}</span>
            </>
          ) : (
            "Welcome to your digital campus"
          )}
        </p>
      )}

      {/* The thesis — the same headline the sign-in panel opens with. */}
      <p className="relative z-10 mt-5 max-w-md px-6 text-center font-display text-[19px] leading-[1.22] font-semibold tracking-tight text-paper-50 sm:text-[22px] md:text-[24px]">
        Every register, ledger and mark sheet,
        <span className="text-marigold-300"> in one place.</span>
      </p>

      {/* One line at a time about life inside the app; the welcome act closes
          with an invitation instead. */}
      {phase === "welcome" ? (
        <p className="relative z-10 mt-3 h-5 px-6 text-center text-[13px] text-brass-100/72 sm:text-[13.5px]">
          Sign in to open today&apos;s registers.
        </p>
      ) : (
        <p
          aria-hidden
          className={`relative z-10 mt-3 h-5 px-6 text-center text-[13px] text-brass-100/72 transition-opacity duration-300 motion-reduce:transition-none sm:text-[13.5px] ${
            lineVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {PRODUCT_LINES[lineIdx]}
        </p>
      )}

      {/* What's inside — the same module chips the sign-in panel carries,
          kept quiet so the tile stays the star. */}
      <ul
        aria-hidden
        className="relative z-10 mt-7 flex max-w-md flex-wrap items-center justify-center gap-2 px-4"
      >
        {MODULES.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-[11px] font-medium text-brass-100/80 backdrop-blur-sm sm:text-[11.5px]"
          >
            <Icon className="size-3 text-marigold-300/90" aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      {/* The register hand, as everywhere else. */}
      <p className="tabular relative z-10 mt-6 text-[11px] font-semibold tracking-[0.2em] text-brass-300 uppercase">
        Opening
        <span className="ml-0.5 inline-block animate-pulse">…</span>
      </p>

      {/* A short, solid brass loader at the foot of the stage. It runs on its
          own clock — 0→100% over the splash's minimum hold — deliberately
          independent of the image fetch, so its pace is identical on every
          load and gives the reader time with the copy above. */}
      <div className="relative z-10 mt-5 h-2.5 w-48 overflow-hidden rounded-full bg-white/10 sm:w-64">
        {/* `w-0` matters: before the animation stylesheet applies (first
            paint after a hard refresh) a block div would default to full
            width — the bar must start empty, never full. */}
        <div className="splash-fill-bar h-full w-0 rounded-full bg-linear-to-r from-brass-500 via-brass-300 to-marigold-300" />
      </div>

      {/* Whose hands built it, at the foot of the page. */}
      <p className="relative z-10 mt-8 px-6 text-center font-mono text-[10px] tracking-wide text-brass-200/50">
        © {new Date().getFullYear()} Colegios · Built by AppMe Soft Pvt Ltd
      </p>

      {/* Global so styled-jsx doesn't rename the keyframes out from under the
          class; names are prefixed to stay collision-safe. */}
      <style jsx global>{`
        /* Keep the bar's duration in step with MIN_SHOW_MS above. */
        .splash-fill-bar {
          animation: splash-fill 4s linear both;
        }
        @keyframes splash-fill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        /* The logo surfaces slowly — faded and slightly small, easing up to
           full presence like ink drying into place. */
        .splash-logo-in {
          animation: splash-logo-in 1.6s ease-out both;
        }
        @keyframes splash-logo-in {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-fill-bar,
          .splash-logo-in {
            animation: none;
          }
          /* Doubled class out-specifies the w-0 utility. */
          .splash-fill-bar.splash-fill-bar {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
