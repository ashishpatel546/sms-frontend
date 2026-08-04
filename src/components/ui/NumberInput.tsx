'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ## Why this exists
 *
 * The obvious way to bind a numeric field is `value={n}` with
 * `onChange={(e) => set(parseInt(e.target.value) || 0)}`. That binding cannot
 * represent an *empty* field: backspacing the last digit gives `''`,
 * `parseInt('') || 0` is `0`, React re-renders the input showing "0", and the
 * next keystroke lands after it — so editing 50 into 40 produces "040".
 *
 * The fix is to keep the text the user is typing as the source of truth while
 * the field has focus, and report a `number | null` upward. "Empty" is a real
 * state, and half-typed values like `-`, `1.` and `0.0` survive long enough to
 * be finished.
 *
 * External updates are still adopted — a form reset or a value loaded from the
 * API replaces the draft — but only when the number genuinely changed
 * elsewhere, so a re-render never rewrites what is under the cursor.
 */

type BaseProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>;

export default function NumberInput({
  value,
  onChange,
  emptyValue,
  className,
  ...rest
}: BaseProps & {
  value: number | null;
  onChange: (value: number | null) => void;
  /**
   * What to report while the field is blank, for parents whose state cannot
   * hold `null`.
   *
   * Reporting it is not the same as *showing* it: the draft stays empty, and
   * because we remember having emitted this number, the value coming back down
   * is recognised as our own and never rewrites what is being typed. Without
   * this, a parent that coerces `null` to `0` would put "0" straight back into
   * the box — the original bug, one hop later.
   */
  emptyValue?: number;
}) {
  const [draft, setDraft] = useState(() =>
    value == null ? '' : String(value),
  );
  // What we last told the parent. Anything else arriving in `value` came from
  // outside this field and should overwrite the draft.
  const emitted = useRef<number | null>(value);

  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setDraft(value == null ? '' : String(value));
    }
  }, [value]);

  const handle = (text: string) => {
    setDraft(text);

    const trimmed = text.trim();
    if (trimmed === '') {
      const blank = emptyValue ?? null;
      emitted.current = blank;
      onChange(blank);
      return;
    }

    const parsed = Number(trimmed);
    // "-" and "1e" are on the way to a number, not numbers. Hold the draft and
    // say nothing rather than reporting NaN.
    if (!Number.isFinite(parsed)) return;

    emitted.current = parsed;
    onChange(parsed);
  };

  return (
    <input
      {...rest}
      type="number"
      value={draft}
      onChange={(e) => handle(e.target.value)}
      className={cn(className)}
    />
  );
}
