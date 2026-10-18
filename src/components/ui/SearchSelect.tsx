'use client';

import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface SearchOption<V extends string | number = number> {
  value: V;
  /** Shown in the list and, once chosen, in the input. */
  label: string;
  /** A second, muted line in the list (role, phone, capacity…). */
  detail?: string;
  /** Extra text the search also matches, such as a mobile number. */
  keywords?: string;
}

/**
 * A select you can type into: the list narrows as you type (label, detail
 * and keywords all match). Use it instead of `Select` when the list can run
 * long, such as staff or vehicles. Works inside dialogs.
 */
export function SearchSelect<V extends string | number>({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
  required,
  className,
}: {
  options: SearchOption<V>[];
  value: V | '' | null;
  onChange: (value: V | '') => void;
  placeholder?: string;
  /** Shown when nothing matches what was typed. */
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const tc = useTranslations('common');
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(o) => onChange(o ? o.value : '')}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(o, query) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [o.label, o.detail, o.keywords].some((s) => s?.toLowerCase().includes(q));
      }}
      disabled={disabled}
      required={required}
    >
      <div className={cn('relative', className)}>
        <Combobox.Input
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-md border border-line-strong bg-surface pr-16 pl-3 text-[14px] text-ink transition-colors sm:h-10',
            'placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none',
            'disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-ink-muted',
          )}
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5 text-ink-faint">
          {selected && !disabled && (
            <Combobox.Clear aria-label={tc('action.clear')} className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-surface-secondary hover:text-ink">
              <X className="size-3.5" />
            </Combobox.Clear>
          )}
          <Combobox.Trigger aria-label={placeholder} className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-surface-secondary hover:text-ink">
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
        </div>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup
            className={cn(
              'w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-lg bg-popover text-popover-foreground',
              'shadow-soft ring-1 ring-foreground/10 outline-none',
              'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            )}
          >
            <Combobox.Empty className="px-3 py-2.5 text-[13px] text-ink-muted empty:hidden">{emptyText ?? tc('state.noResults')}</Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto py-1 empty:hidden">
              {(o: SearchOption<V>) => (
                <Combobox.Item
                  key={o.value}
                  value={o}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[14px] text-ink outline-none select-none data-highlighted:bg-surface-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{o.label}</p>
                    {o.detail && <p className="truncate text-[12px] text-ink-muted">{o.detail}</p>}
                  </div>
                  <Combobox.ItemIndicator>
                    <Check className="size-4 text-brand" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
