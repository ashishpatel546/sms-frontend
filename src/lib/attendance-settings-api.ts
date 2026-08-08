/**
 * attendance-settings-api.ts — Typed client for the staff-attendance
 * settings + today-summary endpoints (`src/modules/hr/staff-attendance` on
 * the backend).
 *
 * Kept separate from `hr-api.ts` (not edited here) because this feature was
 * built in parallel with other work on that file. Uses the exact same
 * token/slug plumbing (`authFetch`) as every other API client in this repo.
 */
import { authFetch } from './auth';
import { getEnv } from './env';

const base = () => getEnv('API_URL') || 'http://localhost:3000';

/** `HH:mm`, 24-hour — mirrors the backend's `UpdateAttendanceSettingsDto` regex exactly. */
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface AttendanceSettings {
  /** Worked hours at/above this on checkout mark the day PRESENT. */
  minFullDayHours: number;
  /** Worked hours at/above this (but below minFullDayHours) mark HALF_DAY; below this, ABSENT. */
  minHalfDayHours: number;
  /** `HH:mm`, 24-hour. A check-in after this time-of-day (IST) sets `isLate`. */
  lateCutoffTime: string;
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  minFullDayHours: 8,
  minHalfDayHours: 4,
  lateCutoffTime: '09:15',
};

export interface AttendanceTodaySummary {
  date: string;
  summary: {
    PRESENT: number;
    /**
     * Legacy bucket: counts records whose `status` field is literally `LATE`.
     * Auto-compute no longer ever sets that value (see the `isLate` column),
     * so this trends toward 0 over time even on a day with plenty of late
     * arrivals — do NOT use this for a "how many were late today" stat, use
     * `lateArrivals` on this same response instead.
     */
    LATE: number;
    ABSENT: number;
    HALF_DAY: number;
    ON_LEAVE: number;
    HOLIDAY: number;
    NOT_MARKED?: number;
  };
  totalStaff: number;
  /** The real, ongoing "late today" count — everyone whose isLate=true for the date. */
  lateArrivals: number;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${base()}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    const err = Object.assign(new Error('Attendance settings API error'), {
      status: res.status,
      info,
    });
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const attendanceSettingsApi = {
  /** TEACHER+ (any staff member) can read — powers the checkout preview on My Attendance. */
  get: () => req<AttendanceSettings>('GET', '/hr/staff-attendance/settings'),
  /** HR_ADMIN / SUPER_ADMIN / SYSTEM_ADMIN only — enforced server-side; a lower role gets a 403. */
  update: (patch: Partial<AttendanceSettings>) =>
    req<AttendanceSettings>('PATCH', '/hr/staff-attendance/settings', patch),
  /** SUB_ADMIN+. `date` defaults to today (server-side, IST) when omitted. */
  todaySummary: (date?: string) =>
    req<AttendanceTodaySummary>(
      'GET',
      `/hr/staff-attendance/today-summary${date ? `?date=${date}` : ''}`,
    ),
};

/** Client-side mirror of the server's validation rule — check before PATCHing. */
export function validateAttendanceSettings(s: AttendanceSettings): string | null {
  if (s.minHalfDayHours >= s.minFullDayHours) {
    return `Half-day threshold (${s.minHalfDayHours}h) must be less than the full-day threshold (${s.minFullDayHours}h).`;
  }
  if (!HHMM_RE.test(s.lateCutoffTime)) {
    return 'Late cutoff must be a valid 24-hour time, e.g. "09:15".';
  }
  return null;
}

export type CheckoutPreviewStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT';

/**
 * Client-side PREVIEW of what `statusFromWorkedHours` on the backend would
 * compute for a checkout happening at `checkOutAt`, given the settings and
 * the recorded check-in time. This is only ever a preview — the backend
 * recomputes for real on submit and always has the last word, so a few
 * seconds/minutes of clock skew between the preview and the actual checkout
 * request is not something callers need to guard against.
 */
export function previewCheckoutStatus(
  checkInIso: string,
  checkOutAt: Date,
  settings: AttendanceSettings,
): { status: CheckoutPreviewStatus; hours: number } {
  const checkIn = new Date(checkInIso);
  const hours = Math.max(0, (checkOutAt.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
  let status: CheckoutPreviewStatus;
  if (hours >= settings.minFullDayHours) status = 'PRESENT';
  else if (hours >= settings.minHalfDayHours) status = 'HALF_DAY';
  else status = 'ABSENT';
  return { status, hours };
}
