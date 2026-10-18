'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

/** "2026-10-17" → "17 Oct 2026" in the reader's language (Latin digits). */
export function useFormatDate() {
  const locale = useLocale() as Locale;
  return React.useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return '—';
      const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    },
    [locale],
  );
}

/** Whole days from today (IST) to a YYYY-MM-DD date; negative once past. */
export function daysUntil(iso: string, today: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(iso) - toUtc(today)) / 86_400_000);
}
