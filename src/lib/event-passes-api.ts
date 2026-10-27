'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT PASSES — the client half of `sms-backend/src/modules/event-passes`.

   A pass belongs to one event (`school_activity`). The office issues and
   prints them (SUB_ADMIN+), the gate verifies and checks them in/out (GUARD+),
   and a parent sees the ones issued to their mobile.
   ═══════════════════════════════════════════════════════════════════════════ */

export type EventPassTier = 'GENERAL' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'ELITE';
export const EVENT_PASS_TIERS: EventPassTier[] = ['GENERAL', 'SILVER', 'GOLD', 'PLATINUM', 'ELITE'];

export type EventPassStatus = 'ACTIVE' | 'CANCELLED';
export type EventPassHolderRelation = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
export const EVENT_PASS_RELATIONS: EventPassHolderRelation[] = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];
export type EventPassVehicleType = 'TWO_WHEELER' | 'FOUR_WHEELER' | 'OTHER';
export const EVENT_PASS_VEHICLE_TYPES: EventPassVehicleType[] = ['TWO_WHEELER', 'FOUR_WHEELER', 'OTHER'];

export const EVENT_PASS_MAX_MEMBERS = 50;

/**
 * Tier colours — one band per tier, printed and on screen. The tier WORD is
 * always printed beside the band, so a black-and-white printout still reads.
 */
export const EVENT_PASS_TIER_COLORS: Record<EventPassTier, { band: string; ink: string }> = {
  GENERAL: { band: '#57504a', ink: '#ffffff' },
  SILVER: { band: '#9aa3ad', ink: '#1c2228' },
  GOLD: { band: '#c99a2e', ink: '#241c12' },
  PLATINUM: { band: '#5b6b7a', ink: '#ffffff' },
  ELITE: { band: '#241c12', ink: '#e2b871' },
};

export interface EventPassStudent {
  id: number;
  name: string;
  className: string | null;
  section: string | null;
  admissionNumber: string | null;
}

export interface EventPass {
  id: string;
  activityId: string;
  serial: number;
  tier: EventPassTier;
  holderName: string | null;
  holderRelation: EventPassHolderRelation | null;
  mobile: string | null;
  students: EventPassStudent[];
  membersAllowed: number;
  memberNames: string[];
  vehicleType: EventPassVehicleType | null;
  vehicleNumber: string | null;
  allDays: boolean;
  validDates: string[];
  remarks: string | null;
  status: EventPassStatus;
  version: number;
  inside: boolean;
  checkedInAt: string | null;
  checkedInOn: string | null;
  checkedInPeople: number | null;
  checkedInByName: string | null;
  printedAt: string | null;
  issuedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on single-pass reads, print data and the parent view. */
  token?: string;
}

export interface EventPassEvent {
  id: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface EventPassSummary {
  eventDays: string[];
  today: string;
  byTier: { tier: EventPassTier; passes: number; people: number }[];
  active: number;
  cancelled: number;
  unprinted: number;
  insidePasses: number;
  insidePeople: number;
  enteredTodayPasses: number;
  checkInsToday: number;
}

export interface EventPassLookup {
  mobile: string;
  students: EventPassStudent[];
  suggestions: { relation: EventPassHolderRelation; name: string }[];
  existingPasses: {
    id: string;
    serial: number;
    tier: EventPassTier;
    status: EventPassStatus;
    holderName: string | null;
    membersAllowed: number;
  }[];
}

export interface EventPassMovement {
  id: number;
  direction: 'IN' | 'OUT';
  people: number;
  eventDate: string;
  byName: string;
  note: string | null;
  createdAt: string;
}

export type EventPassVerdict = 'VALID' | 'NOT_TODAY' | 'CANCELLED' | 'REPLACED' | 'EVENT_CLOSED';

export interface EventPassVerifyResult {
  verdict: EventPassVerdict;
  today: string;
  event: EventPassEvent;
  pass: EventPass;
  todayMovements: EventPassMovement[];
}

export interface ParentEventPass {
  id: string;
  serial: number;
  tier: EventPassTier;
  holderName: string | null;
  students: { name: string; className: string | null; section: string | null }[];
  membersAllowed: number;
  memberNames: string[];
  vehicleType: EventPassVehicleType | null;
  vehicleNumber: string | null;
  allDays: boolean;
  validDates: string[];
  inside: boolean;
  token: string;
  event: EventPassEvent;
}

export interface EventPassInput {
  tier?: EventPassTier;
  holderName?: string;
  holderRelation?: EventPassHolderRelation | null;
  mobile?: string;
  studentIds?: number[];
  membersAllowed?: number;
  memberNames?: string[];
  vehicleType?: EventPassVehicleType | null;
  vehicleNumber?: string | null;
  allDays?: boolean;
  validDates?: string[];
  remarks?: string;
}

export interface EventPassQuery {
  search?: string;
  tier?: EventPassTier;
  status?: EventPassStatus;
  printed?: 'printed' | 'unprinted';
  inside?: boolean;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export class EventPassesApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EventPassesApiError';
    this.status = status;
  }
}

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    throw new EventPassesApiError(message ?? 'The request failed', res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function send<T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* ── Office ─────────────────────────────────────────────────────────────── */

const base = (activityId: string) => `/activities/${activityId}/passes`;

export function fetchEventPasses(activityId: string, query: EventPassQuery): Promise<Paginated<EventPass>> {
  return request(`${base(activityId)}${buildQuery(query)}`);
}

export function fetchEventPassSummary(activityId: string): Promise<EventPassSummary> {
  return request(`${base(activityId)}/summary`);
}

export function lookupEventPassMobile(activityId: string, mobile: string): Promise<EventPassLookup> {
  return request(`${base(activityId)}/lookup${buildQuery({ mobile })}`);
}

export function createEventPass(activityId: string, input: EventPassInput): Promise<EventPass> {
  return send('POST', base(activityId), input);
}

export function updateEventPass(activityId: string, passId: string, input: EventPassInput): Promise<EventPass> {
  return send('PATCH', `${base(activityId)}/${passId}`, input);
}

export function cancelEventPass(activityId: string, passId: string, reason: string): Promise<EventPass> {
  return send('POST', `${base(activityId)}/${passId}/cancel`, { reason });
}

export function reissueEventPass(activityId: string, passId: string, reason: string): Promise<EventPass> {
  return send('POST', `${base(activityId)}/${passId}/reissue`, { reason });
}

export function officeCheckOutEventPass(activityId: string, passId: string, reason: string): Promise<EventPass> {
  return send('POST', `${base(activityId)}/${passId}/check-out`, { reason });
}

export function fetchEventPassMovements(activityId: string, passId: string): Promise<EventPassMovement[]> {
  return request(`${base(activityId)}/${passId}/movements`);
}

export function fetchEventPassPrintData(
  activityId: string,
  passIds: string[],
  markPrinted: boolean,
): Promise<{ event: EventPassEvent; passes: EventPass[] }> {
  return send('POST', `${base(activityId)}/print`, { passIds, markPrinted });
}

/* ── Gate ───────────────────────────────────────────────────────────────── */

export function verifyEventPass(token: string): Promise<EventPassVerifyResult> {
  return send('POST', '/event-passes/verify', { token });
}

export function checkInEventPass(token: string, people: number): Promise<EventPassVerifyResult> {
  return send('POST', '/event-passes/check-in', { token, people });
}

export function checkOutEventPass(token: string): Promise<EventPassVerifyResult> {
  return send('POST', '/event-passes/check-out', { token });
}

/* ── Parent ─────────────────────────────────────────────────────────────── */

export function fetchMyEventPasses(): Promise<ParentEventPass[]> {
  return request('/event-passes/mine');
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** "#0042" — the serial as printed. */
export function passSerial(serial: number): string {
  return `#${String(serial).padStart(4, '0')}`;
}

/** "Aarav Sharma (V-B)" for each linked student, joined. */
export function passStudentsLine(students: { name: string; className: string | null; section: string | null }[]): string {
  return students
    .map((s) => {
      const cls = [s.className, s.section].filter(Boolean).join('-');
      return cls ? `${s.name} (${cls})` : s.name;
    })
    .join(', ');
}

/** Short date as on the pass: "1 Dec". Built from the string, no timezone shift. */
export function passShortDate(day: string, intlLocale = 'en-IN'): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Every day of an event, inclusive — mirrors `EventPassesService.eventDays`. */
export function eventDays(startDate: string, endDate: string | null): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate ?? startDate}T00:00:00Z`);
  while (cursor <= last && days.length < 60) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
