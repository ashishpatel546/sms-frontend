import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an ISO timestamp as "YYYY-MM-DD HH:mm:ss" in the viewer's local
 * timezone. Legacy time-only values ("HH:mm:ss") are returned unchanged.
 */
export function formatTime(val?: string | null, fallback = '—'): string {
  if (!val) return fallback;
  return val.includes('T') ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : val;
}

/**
 * Returns today's date in IST (Asia/Kolkata) as YYYY-MM-DD.
 * Works in both Node.js (server components) and browsers.
 * `new Date().toISOString()` is wrong here — it gives UTC, not IST.
 */
export function todayLocalDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  );
}

/** Natural string comparison: "Class 2" sorts before "Class 10". */
export function naturalCompare(a: string, b: string): number {
  return (a ?? '').localeCompare(b ?? '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Sort an array of { name } objects naturally. Returns a new array. */
export function sortByName<T extends { name?: string | null }>(
  items: T[],
): T[] {
  return [...items].sort((x, y) => naturalCompare(x.name ?? '', y.name ?? ''));
}
