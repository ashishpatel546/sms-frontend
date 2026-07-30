'use client';

import Link from 'next/link';
import { Settings, X } from 'lucide-react';
import { useState } from 'react';
import { usePinnedActions, defaultPinnedActions } from '@/hooks/usePinnedActions';
import { useQuickActionTiles } from '@/lib/quickActions';
import { QuickActionPicker } from '@/components/dashboard/QuickActionPicker';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PIGMENT_CLASS } from '@/components/ui/pigment';

/**
 * The pinned quick actions on the dashboard.
 *
 * The tile list itself lives in useQuickActionTiles() and is shared with the
 * mobile bottom sheet, so an action added there appears in both — and an action
 * pinned on a phone is guaranteed to be renderable on a desktop.
 *
 * A horizontal scroll strip on mobile so nothing shrinks, a wrapping grid above.
 */
export default function QuickActions() {
    const [isCustomizing, setIsCustomizing] = useState(false);
    const { tiles } = useQuickActionTiles();
    const { pinned, isLoaded, togglePin } = usePinnedActions();

    // Before localStorage has been read, fall back to the defaults rather than
    // rendering an empty panel that then pops full.
    const activePins = isLoaded ? pinned : defaultPinnedActions;
    const visibleTiles = tiles.filter(tile => activePins.includes(tile.href));

    return (
        <Panel>
            <PanelHeader
                title="Quick actions"
                action={
                    <button
                        onClick={() => setIsCustomizing(true)}
                        className="hidden cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-brand-tint hover:text-brand md:flex"
                    >
                        <Settings className="size-3.5" />
                        Customize
                    </button>
                }
            />

            <div className="p-4">
                {visibleTiles.length > 0 ? (
                    <div className="no-scrollbar flex min-h-25 gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                        {visibleTiles.map(tile => {
                            const Icon = tile.icon;
                            const p = PIGMENT_CLASS[tile.pigment];
                            return (
                                <Link
                                    key={tile.href}
                                    href={tile.href}
                                    className="group/tile flex w-25 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface px-2 py-3.5 transition-all hover:border-brand-edge hover:bg-brand-tint active:scale-95"
                                >
                                    <span className={`grid size-9 place-items-center rounded-md ${p.tint} ${p.text}`}>
                                        <Icon className="size-4.5" aria-hidden />
                                    </span>
                                    <span className="text-center text-[12px] leading-tight font-medium text-ink">
                                        {tile.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex min-h-25 items-center justify-center rounded-lg border-2 border-dashed border-line px-4 text-center text-[13px] text-ink-muted">
                        No actions pinned yet — choose the ones you use most.
                    </div>
                )}
            </div>

            {/* Desktop customization dialog */}
            {isCustomizing && (
                <>
                    <div
                        className="fixed inset-0 z-60 hidden bg-walnut-950/50 backdrop-blur-sm md:block"
                        onClick={() => setIsCustomizing(false)}
                        aria-hidden
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Customize dashboard actions"
                        className="fixed top-1/2 left-1/2 z-70 hidden w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-glass md:block"
                    >
                        <div className="flex flex-col border-b border-line bg-surface-secondary px-5 py-4">
                            <div className="mb-1 flex items-center justify-between">
                                <h3 className="font-display text-[16px] font-semibold text-ink">Dashboard shortcuts</h3>
                                <button
                                    onClick={() => setIsCustomizing(false)}
                                    className="cursor-pointer rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-inset hover:text-ink"
                                    aria-label="Close"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                            <p className="text-[12.5px] text-ink-muted">
                                Pick the actions you use most. They appear as tiles on your dashboard.
                            </p>
                        </div>
                        <div className="no-scrollbar max-h-[60vh] overflow-y-auto p-5">
                            <QuickActionPicker tiles={tiles} pinned={activePins} onToggle={togglePin} />
                        </div>
                    </div>
                </>
            )}
        </Panel>
    );
}
