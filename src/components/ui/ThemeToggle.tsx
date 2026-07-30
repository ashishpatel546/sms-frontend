"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
] as const;

/**
 * A three-way segmented control rather than a button that cycles through
 * states. The old version needed a wiggling "hint" animation precisely because
 * a single mystery button gives no clue what the next tap does; showing all
 * three options removes the need to teach anything.
 *
 * Icon-only to stay compact in the top bar; each option keeps its own
 * accessible name.
 */
export function ThemeToggle({
  className,
  /** Rendered on the walnut rail or bar rather than on paper. */
  onInk = false,
}: {
  className?: string;
  onInk?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reserve the exact footprint so the top bar doesn't shift on hydration.
  if (!mounted) return <div className="h-9 w-26" aria-hidden />;

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border p-0.5",
        onInk
          ? "border-white/12 bg-white/8"
          : "border-line bg-surface-secondary",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-md transition-all",
              active
                ? onInk
                  ? "bg-white/16 text-marigold-300"
                  : "bg-surface text-brand shadow-soft"
                : onInk
                  ? "text-rail-ink-muted hover:text-rail-ink"
                  : "text-ink-faint hover:text-ink",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
