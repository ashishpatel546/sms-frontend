import type { ReactNode } from 'react';
import { Note } from '@/components/ui/Panel';
import type { Pigment } from '@/components/ui/pigment';

/**
 * A short explanation of what a screen does, sitting above it.
 *
 * The old version carried five hand-picked hues, each with its own dark:
 * variants. It now resolves through the pigment map, so a note's colour states
 * what KIND of note it is rather than which palette entry someone reached for:
 *   info    explains        (default)
 *   attn    warns
 *   danger  states a consequence
 *   success confirms
 *
 * The old `variant` names are kept as aliases so existing call sites keep
 * working; new code should pass `pigment`.
 */
type Variant = 'blue' | 'indigo' | 'amber' | 'green' | 'red';

const TO_PIGMENT: Record<Variant, Pigment> = {
  blue: 'info',
  indigo: 'info',
  amber: 'attn',
  green: 'success',
  red: 'danger',
};

export function InfoBanner({
  title,
  children,
  variant = 'blue',
  pigment,
}: {
  title: string;
  children: ReactNode;
  /** @deprecated Use `pigment` — it says what the note is, not what colour it is. */
  variant?: Variant;
  pigment?: Pigment;
}) {
  return (
    <Note title={title} pigment={pigment ?? TO_PIGMENT[variant]}>
      {children}
    </Note>
  );
}
