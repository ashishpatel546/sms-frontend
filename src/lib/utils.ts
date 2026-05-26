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
