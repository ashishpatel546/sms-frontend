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
  /**
   * When the authorised signatory's signature was last uploaded, or null when
   * the school has never uploaded one (the card then prints a blank rule to
   * sign by hand). Doubles as the cache key for `getSchoolSignature`.
   */
  signatureUpdatedAt: string | null;
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
  mothersName: string | null;
  /** A guardian the school actually recorded. Never a stand-in for a parent. */
  guardianName: string | null;
  guardianRelation: string | null;
  mobile: string | null;
  address: string | null;
  bloodGroup: string | null;
  /**
   * Presigned S3 URL, valid ~15 minutes. Fine for an `<img>`; useless to
   * `fetch()`, because the bucket sends no CORS headers.
   */
  photoUrl: string | null;
  /**
   * API path that proxies the same photo through our own server. Use this
   * whenever the BYTES are needed (the PDF embeds a data URL) — see
   * `loadIdCardPhoto`. Null when the holder has no photo.
   */
  photoPath: string | null;
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
 * What a scan returns: exactly what is PRINTED on the card, and nothing more.
 *
 * Anyone holding the card can already read all of this off the front, so
 * returning it leaks nothing — while letting a guard check the card against
 * its bearer and ring the right parent. Anything not on the card (address,
 * fees, attendance) stays out: a scan proves identity, it is not a directory
 * lookup.
 */
export interface IdCardVerifyResult {
  type: IdCardHolderType;
  name: string;
  photoUrl: string | null;
  className: string | null;
  section: string | null;
  rollNo: number | null;
  designation: string | null;
  department: string | null;
  employeeCode: number | null;
  dob: string | null;
  fathersName: string | null;
  mothersName: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  /** False when the holder has been deactivated — the card is real but stale. */
  active: boolean;
}

export interface StudentIdCardQuery {
  classId?: number | null;
  sectionId?: number | null;
  studentId?: number | null;
  /**
   * Name search. It runs on the SERVER, across the whole roster — filtering the
   * rows already on screen made a student look missing on page 1 and turn up on
   * page 2, because only one page's worth of names had been fetched.
   */
  search?: string | null;
  page?: number;
  limit?: number;
}

export interface StaffIdCardQuery {
  department?: string | null;
  staffId?: number | null;
  /** Server-side name search — see `StudentIdCardQuery.search`. */
  search?: string | null;
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
      search: query.search?.trim() || null,
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
      search: query.search?.trim() || null,
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

/**
 * Formats `@react-pdf/renderer` can actually decode. Anything else thrown at
 * an `<Image src>` rejects the whole document, not just that one image.
 */
const PDF_SAFE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

/**
 * Longest edge, in pixels, of a portrait embedded in a card.
 *
 * The photo prints at roughly 21 × 27 mm, which is ~250 × 320 px at 300 dpi.
 * 640 leaves generous headroom and still keeps a 100-card batch to a file a
 * school office can actually email — the full-size upload is ~1200 px and
 * re-encoding a batch at that size produced a 2 MB card, i.e. a 200 MB PDF
 * for a whole school.
 */
const PDF_PHOTO_MAX_EDGE = 640;

/**
 * Same idea for the school logo, which prints at 7 mm in the masthead. Schools
 * upload whatever their designer sent them — the one that exposed this was
 * 1500 × 1134, i.e. 2 MB of PDF for a 20 pt tile, dwarfing every card on the
 * sheet put together.
 */
const PDF_LOGO_MAX_EDGE = 256;

/**
 * Re-encodes an image to PNG through a canvas.
 *
 * WHY THIS EXISTS: the photo pipeline stores portraits as **WebP** wherever
 * the browser can encode it (see `components/person/photo-pipeline.ts`), and
 * react-pdf's image layer handles only jpeg/jpg/png/gif. Handing it a WebP
 * data URL does not degrade to a missing photo — it rejects the document, so
 * the operator gets "Could not build the PDF" for a whole print run because
 * one child has a portrait. Decoding through a canvas is the browser's own
 * codec doing the conversion, so it costs nothing to keep and works for any
 * format the browser can display but the PDF cannot.
 */
export async function toPdfSafeDataUrl(blob: Blob): Promise<string | null> {
  try {
    return await reencode(blob, PDF_PHOTO_MAX_EDGE, 'image/jpeg', 0.85);
  } catch {
    // No decoder (or a tainted canvas): fall back to passing the bytes through
    // untouched, which still works whenever the source was already a format
    // react-pdf can read.
    if (!PDF_SAFE_IMAGE_TYPES.includes(blob.type)) return null;
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
}

/**
 * The school logo, shrunk and made PDF-safe. Kept PNG so a logo with a
 * transparent background stays transparent over the masthead — a JPEG would
 * paste a white box behind it.
 */
export async function toPdfSafeLogo(
  dataUrl: string | null,
): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return await reencode(blob, PDF_LOGO_MAX_EDGE, 'image/png');
  } catch {
    return /^data:image\/(png|jpe?g|gif)[;,]/i.test(dataUrl) ? dataUrl : null;
  }
}

/** Decode → downscale → re-encode, via the browser's own codecs. */
async function reencode(
  blob: Blob,
  maxEdge: number,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<string | null> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL(type, quality);
}

/**
 * Reads a holder's photo as a PDF-embeddable data URL.
 *
 * It goes through `photoPath` (our API) rather than `photoUrl` (S3) because
 * the private bucket answers presigned GETs but sends no CORS headers: the
 * browser will happily paint that URL into an `<img>`, yet a `fetch()` for the
 * same bytes fails. That is why cards printed with the initials placeholder
 * even for students whose photo had been uploaded.
 *
 * Returns null on any failure — one missing portrait must never cost a school
 * its print run.
 */
export async function loadIdCardPhoto(row: IdCardRow): Promise<string | null> {
  if (!row.photoPath) return null;
  try {
    const res = await authFetch(`${API_BASE_URL}${row.photoPath}`);
    if (!res.ok) return null;
    return await toPdfSafeDataUrl(await res.blob());
  } catch {
    return null;
  }
}

/* ── The authorised signatory's signature ──────────────────────────────────
   Cached in the module for the tab's lifetime, keyed on `signatureUpdatedAt`.

   THE POINT OF THE KEY: a print run of 200 cards embeds the same signature
   200 times. Fetching it once per card would be 200 round trips to S3 through
   our proxy for one unchanging image. Keying on the upload timestamp means the
   cache is correct rather than merely fast — re-upload a signature and the
   timestamp changes, so the next read misses and refetches on its own. The
   explicit `clearSchoolSignatureCache()` exists for the one case the key
   cannot cover: the same tab that just did the uploading, whose branding was
   fetched before the change. */

let signatureCacheKey: string | null = null;
let signatureDataUrl: string | null = null;
let signatureInflight: Promise<string | null> | null = null;

/**
 * The signature as a PDF-embeddable data URL, or null when the school has not
 * uploaded one. Never throws — a card without a signature is a card with a
 * blank rule, which is exactly what schools have today.
 */
export async function getSchoolSignature(
  school: IdCardBranding,
): Promise<string | null> {
  const key = school.signatureUpdatedAt;
  if (!key) return null;
  if (signatureCacheKey === key && signatureDataUrl) return signatureDataUrl;
  if (signatureCacheKey === key && signatureInflight) return signatureInflight;

  signatureCacheKey = key;
  signatureDataUrl = null;
  signatureInflight = (async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/school/signature`);
      if (!res.ok) return null;
      const dataUrl = await toPdfSafeLogo(
        await blobToDataUrl(await res.blob()),
      );
      signatureDataUrl = dataUrl;
      return dataUrl;
    } catch {
      return null;
    } finally {
      signatureInflight = null;
    }
  })();

  return signatureInflight;
}

/** Forces the next `getSchoolSignature` to refetch. */
export function clearSchoolSignatureCache(): void {
  signatureCacheKey = null;
  signatureDataUrl = null;
  signatureInflight = null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Uploads a new signature. Returns the new `signatureUpdatedAt`. */
export async function uploadSchoolSignature(
  file: File,
): Promise<{ signatureUpdatedAt: string }> {
  const body = new FormData();
  body.append('file', file);
  const res = await authFetch(`${API_BASE_URL}/school/signature`, {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new IdCardApiError(
      payload.message ?? 'Could not upload the signature',
      res.status,
    );
  }
  clearSchoolSignatureCache();
  return (await res.json()) as { signatureUpdatedAt: string };
}

export async function removeSchoolSignature(): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/school/signature`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new IdCardApiError('Could not remove the signature', res.status);
  }
  clearSchoolSignatureCache();
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
      classLabel(row.className),
      row.section ? `Sec ${row.section}` : null,
      row.rollNo != null ? `Roll ${row.rollNo}` : null,
    ].filter(Boolean);
    return parts.join('  ·  ') || 'Student';
  }
  // Designation only. Department used to ride along here AND appear in the
  // field grid; it now lives in the grid alone, which is what stops a staff
  // card saying the same thing twice.
  return row.designation ?? row.department ?? 'Staff';
}

/**
 * "Class 9" stays "Class 9"; "9" becomes "Class 9".
 *
 * Schools name their classes every possible way — "9", "Class 9", "IX",
 * "Nursery", "LKG". Blindly prefixing produced "Class Class 9" on the card
 * for every school that spells the word out, so the prefix is only added when
 * the name does not already carry it (and never to a nursery-style name that
 * is not a number or numeral at all).
 */
export function classLabel(className: string | null | undefined): string | null {
  const name = className?.trim();
  if (!name) return null;
  if (/^(class|grade|std\.?|standard)\b/i.test(name)) return name;
  // Only number-ish names read as a class; "Nursery" or "LKG" stand alone.
  return /^(\d+|[IVXLC]+)$/i.test(name) ? `Class ${name}` : name;
}

/**
 * The labelled fields printed BELOW the rule on the card front.
 *
 * Shared by the on-screen preview and the PDF so the two can never drift —
 * a preview that disagrees with the print is worse than no preview.
 *
 * WHAT IS DELIBERATELY ABSENT: class, section, roll number, designation and
 * department. All of those are already in the line under the holder's name
 * (`idCardRoleLine`), and printing them twice was the actual complaint — a
 * card read "Class 9 · Sec A · Roll 6" under the name and then repeated
 * CLASS and ROLL NO in the grid below it. The identity line owns them; this
 * grid owns the family.
 *
 * Date of birth DOES sit here, last — it belongs with the family block and it
 * fills the space this grid used to leave empty under two names. Blood group
 * stays on the bottom band with its vermilion pill: that band is the one an
 * adult reads in a hurry, and the pill is the card's single accent.
 */
export function idCardFields(row: IdCardRow): { label: string; value: string }[] {
  if (row.type === 'STUDENT') {
    const fields = [
      { label: 'FATHER', value: present(row.fathersName) ?? '—' },
      { label: 'MOTHER', value: present(row.mothersName) ?? '—' },
    ];
    // Only when the school actually recorded one. The card used to fall back
    // to the father's name under a GUARDIAN label, which invented a guardian
    // for every student who did not have one.
    const guardian = guardianLabel(row);
    if (guardian) fields.push({ label: 'GUARDIAN', value: guardian });
    fields.push({ label: 'D.O.B.', value: formatIdCardDate(row.dob) });
    return fields;
  }

  // A staff card was reading almost empty — name, designation and nothing
  // else. Employee code and department are the two things a staff member is
  // actually asked for at a counter, so they go on the face of the card.
  //
  // Optional rows are OMITTED rather than printed as a dash: a card that says
  // "DEPARTMENT —" looks broken, whereas one that simply does not mention a
  // department looks finished.
  const fields = [
    {
      label: 'EMP CODE',
      value: row.employeeCode != null ? String(row.employeeCode) : '—',
    },
  ];
  const department = present(row.department);
  if (department) fields.push({ label: 'DEPARTMENT', value: department });
  const father = present(row.fathersName);
  if (father) fields.push({ label: 'FATHER', value: father });
  fields.push({ label: 'D.O.B.', value: formatIdCardDate(row.dob) });
  return fields;
}

/**
 * Trims, and treats an empty string as absent.
 *
 * `??` alone is not enough here: these columns come back as `''` about as
 * often as `null` (a form submitted with the field left blank), and `'' ?? x`
 * is `''` — which is what printed a label with nothing beside it.
 */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** "Vikas Mehta (Uncle)" — or null when no guardian was recorded. */
export function guardianLabel(row: IdCardRow): string | null {
  const name = present(row.guardianName);
  if (!name) return null;
  const relation = present(row.guardianRelation);
  return relation ? `${name} (${relation})` : name;
}

/** The card's own contact and address lines, blank-safe. */
export function idCardContact(
  row: IdCardRow,
  school: IdCardBranding,
): string {
  return present(row.mobile) ?? present(school.phone) ?? '—';
}

export function idCardAddress(row: IdCardRow): string {
  return present(row.address) ?? '—';
}

/**
 * The blood group, or null when none is recorded.
 *
 * Null-vs-blank matters here: the column comes back as `''` as often as
 * `null`, and `'' ?? '—'` is `''` — which drew the vermilion pill as an empty
 * red box. Callers use the null to pick the muted pill instead.
 */
export function idCardBloodGroup(row: IdCardRow): string | null {
  return present(row.bloodGroup);
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
