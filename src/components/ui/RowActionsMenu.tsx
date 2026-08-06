'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   THE ROW ACTIONS MENU

   The three-dot menu at the end of a table row. It exists because the
   hand-rolled version — a `relative` wrapper with an `absolute` dropdown and a
   single shared `openRowId` in the page — breaks inside <DataTable/> in two
   ways:

     · the dropdown is a child of the scroll container (`overflow-x-auto`,
       which forces `overflow-y` to a scrolling value too), so it is clipped
       and the last rows' menus are only reachable by scrolling the table;
     · DataTable renders every cell twice — once in the desktop table, once in
       the mobile card — so one shared ref ends up pointing at the copy that
       mounted last, and the "click outside" handler tears the menu down on
       mousedown before the item's click ever lands.

   Base UI's Menu portals the popup out of the scroll container and anchors it
   to the trigger, and each menu owns its own open state, so neither failure
   mode is expressible.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RowAction {
  label: React.ReactNode;
  /** Run on select. Ignored when `href` is set. */
  onSelect?: () => void;
  /** Navigate instead of acting. */
  href?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Destructive actions are tinted red. */
  danger?: boolean;
}

export interface RowActionsMenuProps {
  /** Falsy entries are dropped, so callers can inline permission checks. */
  actions: (RowAction | false | null | undefined)[];
  /** Accessible name for the trigger. */
  label?: string;
  className?: string;
}

const itemClass =
  'flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-[13.5px] ' +
  'text-ink outline-none select-none data-highlighted:bg-brand-tint ' +
  'data-disabled:cursor-not-allowed data-disabled:opacity-45';

export function RowActionsMenu({ actions, label = 'Actions', className }: RowActionsMenuProps) {
  const items = actions.filter(Boolean) as RowAction[];
  if (items.length === 0) return null;

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={label}
        title={label}
        // The row itself may be clickable; opening the menu is not a row click.
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center rounded-full p-1.5',
          'text-ink-faint transition-colors hover:bg-surface-secondary hover:text-ink',
          'focus-visible:ring-3 focus-visible:ring-brand/16 focus-visible:outline-none',
          'data-popup-open:bg-surface-secondary data-popup-open:text-ink',
          className,
        )}
      >
        <MoreVertical className="size-4" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Menu.Popup
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'min-w-40 overflow-hidden rounded-lg bg-popover py-1 text-popover-foreground',
              'shadow-soft ring-1 ring-foreground/10 outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            {/* A disabled link is not a link — it falls back to an inert item. */}
            {items.map((action, i) =>
              action.href && !action.disabled ? (
                <Menu.LinkItem
                  key={i}
                  closeOnClick
                  className={cn(itemClass, action.danger && 'text-accent-danger-deep')}
                  render={<Link href={action.href} />}
                >
                  {action.icon}
                  {action.label}
                </Menu.LinkItem>
              ) : (
                <Menu.Item
                  key={i}
                  disabled={action.disabled}
                  onClick={() => action.onSelect?.()}
                  className={cn(itemClass, action.danger && 'text-accent-danger-deep')}
                >
                  {action.icon}
                  {action.label}
                </Menu.Item>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default RowActionsMenu;
