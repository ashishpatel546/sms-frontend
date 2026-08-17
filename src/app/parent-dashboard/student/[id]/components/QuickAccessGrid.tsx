'use client';

import React from 'react';
import {
  SECTION_STYLE,
  MORE_CHIP,
  QUICK_ACCESS_PRIMARY,
  QUICK_ACCESS_SECONDARY,
  type SectionKey,
} from '../sectionStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   Every section, as app icons.

   Twelve chips at once reads as an admin console, so the seven a parent opens
   on an ordinary day are shown and the rest sit behind "More", which expands
   the same grid in place rather than opening a sheet — the point is to see the
   extra five without losing the page you were on.
   ═══════════════════════════════════════════════════════════════════════════ */

interface QuickAccessGridProps {
  onSelect: (key: SectionKey) => void;
}

const Chip = ({
  gradient,
  path,
  label,
  onClick,
  expanded,
  controls,
}: {
  gradient: string;
  path: string;
  label: string;
  onClick: () => void;
  /** Only the More chip is an expander; everything else navigates. */
  expanded?: boolean;
  controls?: string;
}) => (
  <button
    onClick={onClick}
    aria-expanded={expanded}
    aria-controls={controls}
    className="group/chip flex cursor-pointer flex-col items-center gap-1.5 rounded-lg py-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
  >
    <span
      className={`grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft ring-1 ring-black/10 transition-transform duration-200 group-hover/chip:-translate-y-0.5 group-active/chip:scale-95 motion-reduce:transform-none dark:ring-white/10 ${gradient}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden focusable="false">
        <path fill="currentColor" d={path} />
      </svg>
    </span>
    <span className="w-full truncate text-center text-[10px] leading-tight font-semibold text-ink-muted">
      {label}
    </span>
  </button>
);

export const QuickAccessGrid = ({ onSelect }: QuickAccessGridProps) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-soft">
      <p className="eyebrow mb-3">Quick access</p>
      <div
        id="quick-access-chips"
        className="grid grid-cols-4 gap-x-2 gap-y-3.5 sm:grid-cols-6"
      >
        {QUICK_ACCESS_PRIMARY.map((key) => (
          <Chip
            key={key}
            gradient={SECTION_STYLE[key].gradient}
            path={SECTION_STYLE[key].path}
            label={SECTION_STYLE[key].label}
            onClick={() => onSelect(key)}
          />
        ))}

        {/* Ordered after the primaries, before the extras, without needing a
            second markup branch for the two states. */}
        <Chip
          gradient={MORE_CHIP.gradient}
          path={MORE_CHIP.path}
          label={expanded ? 'Less' : 'More'}
          onClick={() => setExpanded((v) => !v)}
          expanded={expanded}
          controls="quick-access-chips"
        />

        {expanded &&
          QUICK_ACCESS_SECONDARY.map((key) => (
            <Chip
              key={key}
              gradient={SECTION_STYLE[key].gradient}
              path={SECTION_STYLE[key].path}
              label={SECTION_STYLE[key].label}
              onClick={() => onSelect(key)}
            />
          ))}
      </div>
    </div>
  );
};
