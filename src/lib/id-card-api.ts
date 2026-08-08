'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   ID CARDS — the client half of `sms-backend/src/modules/id-cards`.

   The backend hands back a batch as `{ school, page, limit, total, rows }`:
   the school branding block appears ONCE per response rather than being
   repeated on every row, because a print run of 200 cards would otherwise
   carry 200 copies of the same address.

   Everything here is read-only. There is no "create card" call — a card is
   derived from the roster on demand, which is why a reprint never needs a
   stored record and a QR never expires.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Server-side cap on rows per page. Each row costs one S3 presign for the
 * holder's photo, so the batch endpoints refuse anything larger — the page
 * size selector must never offer a number above this.
 */
export const ID_CARD_MAX_PAGE_SIZE = 100;
export const ID_CARD_DEFAULT_PAGE_SIZE = 50;

/** Page sizes offered in the UI. All at or below the server cap. */
export const ID_CARD_PAGE_SIZES = [25, 50, 100] as const;

export type IdCardHolderType = 'STUDENT' | 'STAFF';

/** The school block, returned once per batch. */
export interface IdCardBranding {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  /** Academic session label, e.g. "2026–27". Printed on both faces. */
  session: string | null;
}

export interface IdCardRow {
  type: IdCardHolderType;
  studentId: number | null;
  staffId: number | null;
  name: string;
  className: string | null;
  section: string | null;
  rollNo: number | null;
  designation: string | null;
  department: string | null;
  employeeCode: number | null;
  dob: string | null;
  fathersName: string | null;
  guardianName: string | null;
  mobile: string | null;
  address: string | null;
  bloodGroup: string | null;
  /** Presigned S3 URL, valid ~15 minutes. Null when the holder has no photo. */
  photoUrl: string | null;
  /** Raw QR content, already carrying the `IDC1:` prefix. */
  qrToken: string;
}

export interface IdCardBatch {
  school: IdCardBranding;
  page: number;
  limit: number;
  total: number;
  rows: IdCardRow[];
}

/**
 * What a gate guard is allowed to learn from a scan. Deliberately narrow —
 * no date of birth, parents, address or mobile. A scan proves identity; it is
 * not a lookup into the student directory.
 */
export interface IdCardVerifyResult {
  type: IdCardHolderType;
  name: string;
  photoUrl: string | null;
  className: string | null;
  section: string | null;
  designation: string | null;
  /** False when the holder has been deactivated — the card is real but stale. */
  active: boolean;
}

export interface StudentIdCardQuery {
  classId?: number | null;
  sectionId?: number | null;
  studentId?: number | null;
  page?: number;
  limit?: number;
}

export interface StaffIdCardQuery {
  department?: string | null;
  staffId?: number | null;
  page?: number;
  limit?: number;
}

/**
 * A failed ID-card request, carrying the HTTP status so callers can tell
 * "your school does not have this module" (403 from the feature guard) apart
 * from a genuine failure. Those two need completely different screens.
 */
export class IdCardApiError extends Error {
  readonly status: number;
  /** True when the `id_cards` feature flag is off for this school. */
  readonly featureDisabled: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'IdCardApiError';
    this.status = status;
    this.featureDisabled = status === 403 && /not enabled/i.test(message);
  }
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new IdCardApiError(
      body.message ?? 'Could not load ID card data',
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** Clamp to the server's cap so a hand-edited URL can never 400 the page. */
function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return ID_CARD_DEFAULT_PAGE_SIZE;
  return Math.min(ID_CARD_MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

export function fetchStudentIdCards(query: StudentIdCardQuery): Promise<IdCardBatch> {
  return getJson<IdCardBatch>(
    `/id-cards/students${buildQuery({
      classId: query.classId,
      sectionId: query.sectionId,
      studentId: query.studentId,
      page: query.page ?? 1,
      limit: clampLimit(query.limit),
    })}`,
  );
}

export function fetchStaffIdCards(query: StaffIdCardQuery): Promise<IdCardBatch> {
  return getJson<IdCardBatch>(
    `/id-cards/staff${buildQuery({
      department: query.department?.trim() || null,
      staffId: query.staffId,
      page: query.page ?? 1,
      limit: clampLimit(query.limit),
    })}`,
  );
}

/** Gate scanner. `token` is the raw QR content, `IDC1:` prefix included. */
export function verifyIdCard(token: string): Promise<IdCardVerifyResult> {
  return getJson<IdCardVerifyResult>('/id-cards/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/**
 * The parent portal's own card endpoint. Ownership of the child is proven
 * server-side, so there is nothing to check here.
 */
export function fetchParentStudentIdCard(
  studentId: number | string,
): Promise<{ school: IdCardBranding; card: IdCardRow }> {
  return getJson<{ school: IdCardBranding; card: IdCardRow }>(
    `/parent/student/${studentId}/id-card`,
  );
}

/* ── Display helpers, shared by the preview, the PDF and the scanner ──────── */

/** A stable identity for a row — students and staff share the list. */
export function idCardKey(row: IdCardRow): string {
  return `${row.type}-${row.studentId ?? row.staffId ?? row.qrToken.slice(-12)}`;
}

export function idCardInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * The line under the holder's name: what they are at this school.
 * Students read as class → section → roll; staff as designation → department.
 */
export function idCardRoleLine(row: IdCardRow): string {
  if (row.type === 'STUDENT') {
    const parts = [
      row.className ? `Class ${row.className}` : null,
      row.section ? `Sec ${row.section}` : null,
      row.rollNo != null ? `Roll ${row.rollNo}` : null,
    ].filter(Boolean);
    return parts.join('  ·  ') || 'Student';
  }
  const parts = [row.designation, row.department].filter(Boolean);
  return parts.join('  ·  ') || 'Staff';
}

/** dd Mon yyyy — the format every printed document in this app uses. */
export function formatIdCardDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
