"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Popover } from "@base-ui/react/popover";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { PALETTES, type PaletteId } from "@/lib/palettes";
import { usePalette } from "@/components/providers/PaletteProvider";
import { PalettePreview } from "@/components/ui/PalettePreview";

/* ═══════════════════════════════════════════════════════════════════════════
   THE THEME PICKER

   One button in the top bar, holding the two axes of the theme:

     Appearance   light · dark · auto      (next-themes, `data-theme`)
     Palette      Register & Ink · Assembly (`data-palette`)

   They are separate on purpose. Folding them into one flat list is the obvious
   simplification and it is wrong: it makes "I want the blue one" and "I want
   the dark one" mutually exclusive, so anyone who works in dark mode can never
   try a new palette without giving up dark mode first.

   The trigger shows the live palette's three pigments rather than a paint-pot
   icon, so the button states which theme is on without being opened.

   Popover rather than Menu: this is a form of two radio groups, not a list of
   commands, and Base UI's Menu wants its children to be items. The popup still
   portals out of the top bar — which matters for the same reason it does in
   RowActionsMenu, since the bar is a fixed, clipping container.
   ═══════════════════════════════════════════════════════════════════════════ */

const APPEARANCE = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
] as const;

export function ThemePicker({
    className,
    /** Rendered on the rail or a coloured bar rather than on paper. */
    onInk = false,
}: {
    className?: string;
    onInk?: boolean;
}) {
    const { theme, setTheme } = useTheme();
    const { palette, setPalette } = usePalette();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Reserve the exact footprint so the bar does not shift on hydration.
    if (!mounted) return <div className="size-9" aria-hidden />;

    return (
        <Popover.Root>
            <Popover.Trigger
                aria-label="Theme"
                title="Theme"
                className={cn(
                    "flex size-9 cursor-pointer items-center justify-center gap-[3px] rounded-lg border transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-brand/16 focus-visible:outline-none",
                    onInk
                        ? "border-rail-line bg-rail-selected hover:bg-rail-hover"
                        : "border-line bg-surface-secondary hover:bg-surface-inset",
                    className,
                )}
            >
                {/* The live palette, read from tokens so it follows the switch. */}
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                <span aria-hidden className="size-1.5 rounded-full bg-accent-success" />
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                    <Popover.Popup
                        className={cn(
                            "w-75 rounded-xl border border-line bg-popover p-3 text-popover-foreground",
                            "shadow-glass outline-none",
                            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                        )}
                    >
                        {/* ── Appearance ─────────────────────────────────── */}
                        <p className="eyebrow mb-1.5">Appearance</p>
                        <div
                            role="radiogroup"
                            aria-label="Appearance"
                            className="flex gap-0.5 rounded-lg border border-line bg-surface-secondary p-0.5"
                        >
                            {APPEARANCE.map(({ value, label, icon: Icon }) => {
                                const active = theme === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setTheme(value)}
                                        className={cn(
                                            "flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md",
                                            "text-[12.5px] font-semibold transition-colors",
                                            active
                                                ? "bg-surface text-brand shadow-soft"
                                                : "text-ink-muted hover:text-ink",
                                        )}
                                    >
                                        <Icon className="size-3.5" aria-hidden />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Palette ────────────────────────────────────── */}
                        <p className="eyebrow mt-3.5 mb-1.5">Palette</p>
                        <div
                            role="radiogroup"
                            aria-label="Palette"
                            className="flex flex-col gap-1.5"
                        >
                            {PALETTES.map((p) => {
                                const active = palette === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setPalette(p.id as PaletteId)}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-left transition-colors",
                                            active
                                                ? "border-brand bg-brand-tint"
                                                : "border-line hover:bg-surface-secondary",
                                        )}
                                    >
                                        <PalettePreview palette={p} />
                                        <span className="min-w-0">
                                            <span className="block truncate text-[13px] font-semibold text-ink">
                                                {p.name}
                                            </span>
                                            <span className="block truncate text-[11px] text-ink-muted">
                                                {p.hint}
                                            </span>
                                        </span>
                                        {active && (
                                            <Check className="ml-auto size-4 shrink-0 text-brand" aria-hidden />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default ThemePicker;
