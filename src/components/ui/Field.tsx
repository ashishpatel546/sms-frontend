'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   FORM FURNITURE

   Labels are always visible — a placeholder is an example, never a label, and
   it disappears exactly when someone needs it. Errors sit under the field they
   belong to, in the interface's voice, saying what to do next.
   ═══════════════════════════════════════════════════════════════════════════ */

const CONTROL_BASE =
  'w-full rounded-md border bg-surface px-3 text-[14px] text-ink transition-colors ' +
  'placeholder:text-ink-faint ' +
  'focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-ink-muted';

/** 40px on desktop, 44px on touch — the minimum comfortable tap target. */
const CONTROL_HEIGHT = 'h-11 sm:h-10';

export function Label({
  children,
  htmlFor,
  required,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('eyebrow block', className)}>
      {children}
      {required && (
        <span aria-hidden className="ml-1 text-accent-danger">
          *
        </span>
      )}
    </label>
  );
}

interface FieldProps {
  label?: React.ReactNode;
  /** The field's own id, so the label and error are wired to the control. */
  htmlFor?: string;
  required?: boolean;
  /** What to type, or what the value affects. Not a repeat of the label. */
  hint?: React.ReactNode;
  /** Sits directly under the control, in vermilion. */
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Span two columns in a FieldGrid. */
  wide?: boolean;
}

/** Label + control + hint/error, spaced the same way on every form. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  wide,
}: FieldProps) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required} className="mb-1.5">
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-accent-danger-deep">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        CONTROL_BASE,
        CONTROL_HEIGHT,
        'border-line-strong aria-invalid:border-accent-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL_BASE, 'border-line-strong py-2.5 leading-relaxed', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

/**
 * A native select, restyled. Native is deliberate: on a phone it opens the OS
 * picker, which beats any custom menu for a 40-class dropdown.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL_BASE,
          CONTROL_HEIGHT,
          'cursor-pointer appearance-none border-line-strong pr-9',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint"
      />
    </div>
  ),
);
Select.displayName = 'Select';

/** A checkbox with its label as one tap target. */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<'input'> & { label: React.ReactNode; description?: React.ReactNode }) {
  // Called unconditionally — a hook behind `??` would run in a different order
  // depending on whether the caller passed an id.
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md py-1.5 transition-colors',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-brand"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12px] text-ink-muted">{description}</span>
        )}
      </span>
    </label>
  );
}

/** The grid forms lay their fields out on. One column on a phone, two above. */
export function FieldGrid({
  children,
  className,
  columns = 2,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        'grid gap-x-4 gap-y-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A named group of fields inside a long form. Progressive disclosure by
 * section rather than one 40-field wall — the admission form is the reason
 * this exists.
 */
export function Fieldset({
  legend,
  description,
  children,
  className,
}: {
  legend: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-0.5 font-display text-[15px] font-semibold text-ink">
        {legend}
      </legend>
      {description && <p className="mb-3.5 text-[12.5px] text-ink-muted">{description}</p>}
      <div className={cn(!description && 'mt-3.5')}>{children}</div>
    </fieldset>
  );
}
