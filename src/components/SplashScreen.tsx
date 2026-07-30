"use client";
import Image from "next/image";
import { useSchoolInfo } from "@/lib/useSchoolInfo";

import { useEffect, useState } from "react";

/**
 * The first thing anyone sees. It should say "this school", so it is walnut and
 * brass like the rest of the app rather than the generic navy/indigo it used to
 * be — that splash belonged to no product in particular.
 *
 * Four defects were fixed here at the same time, all of which shipped:
 *   - the caption read "Initiali-ing..."
 *   - `--10` appeared twice where `z-10` was meant, so it compiled to nothing
 *   - the spinner's SVG path ended `h4-` instead of `h4z`, leaving it unclosed
 *   - `z-9999` is not on Tailwind's z-scale (0/10/20/30/40/50/auto), so the
 *     overlay had no stacking order at all; it needs `z-[9999]`
 *
 * Timing behaviour is unchanged: fade at 1.5s once school info lands, gone at
 * 2s, with a 3s hard fallback if the API never answers.
 */
export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const schoolInfo = useSchoolInfo();

  useEffect(() => {
    // Don't start the timer until we know the school info (and thus the logo URL).
    // Also cap the wait at 3s so a slow API never blocks the splash forever.
    if (schoolInfo === null) return;

    // Start fading out after 1.5s from when the info arrived
    const fadeTimer = setTimeout(() => {
      setFade(true);
    }, 1500);

    // Remove from DOM after 2.0s
    const hideTimer = setTimeout(() => {
      setShow(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [schoolInfo]);

  // Hard timeout: if schoolInfo never arrives after 3s, dismiss anyway
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setFade(true);
      setTimeout(() => setShow(false), 500);
    }, 3000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-label="Opening"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-walnut-950 transition-opacity duration-500 ease-in-out ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* A brass bloom in the upper area, the same light the sidebar rail has —
          so the splash and the app behind it are lit from the same place. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 38%, rgba(169,103,12,0.30) 0%, transparent 62%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 flex size-40 items-center justify-center rounded-2xl border border-brass-500/25 bg-white/6 p-6 shadow-2xl backdrop-blur-md md:size-52">
        {schoolInfo?.logoUrl ? (
          <Image
            src={schoolInfo.logoUrl}
            alt=""
            width={256}
            height={256}
            className="size-full object-contain drop-shadow-xl"
            unoptimized
          />
        ) : (
          <div className="skeleton size-full rounded-xl" />
        )}
      </div>

      {schoolInfo?.name && (
        <p className="relative z-10 mt-7 px-6 text-center font-display text-[19px] font-semibold text-paper-50">
          {schoolInfo.name}
        </p>
      )}

      {/* The register hand, as everywhere else. */}
      <p className="tabular relative z-10 mt-3 text-[11px] font-semibold tracking-[0.2em] text-brass-300 uppercase">
        Opening
        <span className="ml-0.5 inline-block animate-pulse">…</span>
      </p>
    </div>
  );
}
