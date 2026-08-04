'use client';

import { Minus, Plus } from 'lucide-react';
import { PIGMENT_CLASS } from '@/components/ui/pigment';
import type { QuickActionTile } from '@/lib/quickActions';

/**
 * The add/remove list behind "Customize". Rendered inside a dialog on desktop
 * and a bottom sheet on mobile — one component, so the two can't drift.
 */
export function QuickActionPicker({
  tiles,
  pinned,
  onToggle,
}: {
  tiles: QuickActionTile[];
  pinned: string[];
  onToggle: (href: string) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-2" role="list">
      {tiles.map(tile => {
        const Icon = tile.icon;
        const isPinned = pinned.includes(tile.href);
        const p = PIGMENT_CLASS[tile.pigment];
        return (
          <li
            key={tile.href}
            className={`flex items-center justify-between rounded-lg border border-line px-3 py-2.5 transition-colors ${
              isPinned ? 'bg-surface-secondary' : 'bg-surface'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-8 shrink-0 place-items-center rounded-md ${p.tint} ${p.text}`}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="truncate text-[13.5px] font-medium text-ink">{tile.label}</span>
            </div>
            <button
              onClick={() => onToggle(tile.href)}
              className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border transition-colors ${
                isPinned
                  ? 'border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep hover:bg-accent-danger hover:text-white'
                  : 'border-brand-edge bg-brand-tint text-brand hover:bg-brand hover:text-brand-contrast'
              }`}
              aria-label={
                isPinned
                  ? `Remove ${tile.label} from the dashboard`
                  : `Add ${tile.label} to the dashboard`
              }
            >
              {isPinned ? <Minus className="size-4" /> : <Plus className="size-4" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
