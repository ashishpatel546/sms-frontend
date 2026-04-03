"use client";
import { getEnv } from "@/lib/env";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const [imgSrc, setImgSrc] = useState(
    getEnv('SCHOOL_LOGO_URL') || "/colegios/Colegios.png"
  );

  useEffect(() => {
    // Start fading out after 1.5s
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
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-slate-950" />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.5) 0%, transparent 60%)`
        }}
      />
      
      {/* Logo Container */}
      <div className="relative z-10 w-48 h-48 md:w-64 md:h-64 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/20 p-6 animate-pulse">
        <img
          src={imgSrc}
          alt="School"
          className="w-full h-full object-contain drop-shadow-xl"
          onError={() => setImgSrc("/colegios/Colegios.png")}
        />
      </div>

      <div className="relative z-10 mt-12 text-slate-400 text-sm font-semibold tracking-widest uppercase flex items-center gap-3">
        <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Initializing...
      </div>
    </div>
  );
}
