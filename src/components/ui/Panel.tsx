import * as React from 'react';
import { cn } from '@/lib/utils';
import { PIGMENT_CLASS, type Pigment } from './pigment';

/**
 * The one content container. A card is paper on paper: a hairline, a soft
 * shadow, and nothing else. Glass and heavy shadows are reserved for things
 * that float (modals, sheets) so elevation still means something.
 */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-soft',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A panel's header: title, optional description, optional right-side action. */
export function PanelHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-secondary px-4 py-3',
        className,
      )}
    >
      {(title || description) && (
        <div className="min-w-0">
          {title && (
            <h2 className="font-display text-[15px] leading-tight font-semibold text-ink">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>
          )}
        </div>
      )}
      {children}
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function PanelBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-line bg-surface-secondary px-4 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A tinted note explaining context. The pigment carries the register: `info`
 * explains, `attn` warns, `danger` states a consequence. Replaces the old
 * per-hue InfoBanner variants so notes can't drift from the palette.
 */
export function Note({
  title,
  children,
  pigment = 'info',
  icon,
  className,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  pigment?: Pigment;
  icon?: React.ReactNode;
  className?: string;
}) {
  const p = PIGMENT_CLASS[pigment];
  return (
    <div
      className={cn('rounded-lg border px-4 py-3', p.chip.replace('font-semibold', ''), className)}
    >
      <div className="flex gap-2.5">
        {icon && <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', p.text)}>{icon}</span>}
        <div className="min-w-0">
          {title && <p className="text-[13.5px] font-semibold">{title}</p>}
          {children && (
            <div className={cn('text-[12.5px] leading-relaxed', title && 'mt-0.5', 'opacity-90')}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A labelled figure inside a panel — the read-only counterpart to a form
 * field. Used by every detail page so "label above value" is one shape.
 */
export function Detail({
  label,
  children,
  className,
  mono = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('mt-0.5 text-[13.5px] text-ink', mono && 'tabular')}>
        {children ?? '—'}
      </dd>
    </div>
  );
}

/** The grid detail pages lay their `<Detail>` items out on. */
export function DetailGrid({
  children,
  className,
  columns = 3,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-3.5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </dl>
  );
}
