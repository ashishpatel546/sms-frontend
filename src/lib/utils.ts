import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
