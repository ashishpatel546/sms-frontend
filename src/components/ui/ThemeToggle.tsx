"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const HINT_KEY = "theme-toggle-hint-seen";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setMounted(true);
    // First-time visitor: show the discoverable pulse hint
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(HINT_KEY)) {
        setShowHint(true);
        // Auto-dismiss after 8 seconds so it doesn't annoy
        const t = setTimeout(() => setShowHint(false), 8000);
        return () => clearTimeout(t);
      }
    } catch { /* localStorage unavailable — no-op */ }
  }, []);

  if (!mounted) return <div className="w-8 h-8" aria-hidden />;

  const dismissHint = () => {
    if (!showHint) return;
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, "1"); } catch { /* no-op */ }
  };

  const cycleTheme = () => {
    dismissHint();
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("teal");
    else if (theme === "teal") setTheme("system");
    else setTheme("light");
  };

  const label =
    theme === "dark"   ? "Switch to Teal theme"   :
    theme === "teal"   ? "Switch to Auto (System)" :
    theme === "system" ? "Switch to Light theme"   :
    "Switch to Dark theme";

  return (
    <button
      onClick={cycleTheme}
      onMouseEnter={dismissHint}
      onFocus={dismissHint}
      aria-label={label}
      title={label}
      className={`relative p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-secondary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${showHint ? "theme-toggle-hint" : ""} ${className ?? ""}`}
    >
      {/* Discoverability ping — only on very first visit */}
      {showHint && (
        <span aria-hidden className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand" />
        </span>
      )}
      {/* Dark — Moon */}
      {theme === "dark" && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {/* Teal — Droplet */}
      {theme === "teal" && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2C12 2 5 10.4 5 14.5a7 7 0 0014 0C19 10.4 12 2 12 2z" />
        </svg>
      )}
      {/* System — Monitor */}
      {theme === "system" && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
      {/* Light — Sun (default / any unknown) */}
      {(theme === "light" || !theme) && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
        </svg>
      )}
    </button>
  );
}
