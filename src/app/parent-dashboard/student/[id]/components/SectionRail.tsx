'use client';

import React from 'react';
import { House } from 'lucide-react';
import {
  SECTION_STYLE,
  QUICK_ACCESS_PRIMARY,
  QUICK_ACCESS_SECONDARY,
  type SectionKey,
} from '../sectionStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   Navigation once you have left Today.

   Quick Access is the navigation on the Today view, so the old twelve-tile grid
   above every panel is gone. Inside a section a parent still needs to move
   sideways and get back, so this is a compact scrolling rail: Today first,
   acting as back, then every section in the same order as the grid.
   ═══════════════════════════════════════════════════════════════════════════ */

const RAIL_ORDER: SectionKey[] = [...QUICK_ACCESS_PRIMARY, ...QUICK_ACCESS_SECONDARY];

interface SectionRailProps {
  active: SectionKey;
  onSelect: (key: SectionKey | 'home') => void;
}

export const SectionRail = ({ active, onSelect }: SectionRailProps) => {
  const activeRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <div
      role="tablist"
      aria-label="Student sections"
      className="no-scrollbar sticky top-14 z-30 -mx-3 flex snap-x gap-2 overflow-x-auto border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur-sm sm:-mx-5 sm:px-5"
    >
      <button
        onClick={() => onSelect('home')}
        className="flex shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand-edge hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        <House className="size-3.5" aria-hidden />
        Today
      </button>

      {RAIL_ORDER.map((key) => {
        const isActive = key === active;
        const style = SECTION_STYLE[key];
        return (
          <button
            key={key}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${key}`}
            id={`tab-${key}`}
            onClick={() => onSelect(key)}
            className={`flex shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              isActive
                ? 'border-brand bg-brand text-brand-contrast'
                : 'border-line bg-surface text-ink-soft hover:border-brand-edge hover:text-brand'
            }`}
          >
            {/* The chip keeps its own colour when inactive so the rail reads as
                the same set of icons the grid showed, just smaller. */}
            <span
              className={`grid size-4.5 shrink-0 place-items-center rounded-[5px] ${
                isActive ? 'bg-brand-contrast/20 text-brand-contrast' : `text-white ${style.gradient}`
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-3" aria-hidden focusable="false">
                <path fill="currentColor" d={style.path} />
              </svg>
            </span>
            {style.label}
          </button>
        );
      })}
    </div>
  );
};
