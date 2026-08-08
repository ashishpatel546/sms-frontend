/**
 * person-documents-api.ts — typed client for `/person-documents/**`.
 *
 * Two things live behind this one module because they share a table and a
 * permission model:
 *
 *   PHOTOS      one image per person per slot (self / father / mother /
 *               guardian), stored in a private bucket and read back through a
 *               short-lived signed URL. Uploads carry a client-generated
 *               thumbnail alongside the full image — see `photo-pipeline.ts`
 *               for why the browser, not the server, does the resizing.
 *
 *   CHECKLIST   one row per (person, owner, document type) recording whether
 *               the school actually holds the paper. A row can be COLLECTED
 *               with no file at all: the office keeps a physical photocopy far
 *               more often than a scan.
 *
 * Kept out of the shared `api.ts` on purpose — that module is a bare fetcher
 * shared by every page, and this is a domain client with its own types.
 */
import { authFetch } from './auth';
import { getEnv } from './env';

const base = () => getEnv('API_URL') || 'http://localhost:3000';

/* ── Types ──────────────────────────────────────────────────────────────── */

/** Which photo slot on a person's record an upload targets. */
export type PhotoKind = 'self' | 'father' | 'mother' | 'guardian';

/** Whose paper a checklist row is about. Always attached to the person's id. */
export type PersonDocumentOwner = 'SELF' | 'FATHER' | 'MOTHER' | 'GUARDIAN';

/**
 * PENDING   expected, not handed over — what the trace report lists
 * COLLECTED the school holds a physical copy
 * UPLOADED  a scan is stored; set by the file endpoints only, never by upsert
 */
export type PersonDocumentStatus = 'PENDING' | 'COLLECTED' | 'UPLOADED';

export type PersonDocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'BIRTH_CERTIFICATE'
  | 'TRANSFER_CERTIFICATE'
  | 'ADDRESS_PROOF'
  | 'INCOME_CERTIFICATE'
  | 'CASTE_CERTIFICATE'
  | 'PREVIOUS_MARKSHEET'
  | 'PHOTO'
  | 'OTHER';

export interface PersonDocument {
  id: number;
  userId: number;
  owner: PersonDocumentOwner;
  docType: PersonDocumentType;
  status: PersonDocumentStatus;
  s3Key: string | null;
  fileName: string | null;
  mimeType: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface PhotoUploadResult {
  userId: number;
  kind: PhotoKind;
  s3Key: string;
  thumbS3Key: string | null;
}

export interface PhotoUrlResult {
  /** The requested variant. Render this. */
  url: string;
  /** Always present — swap to it in the image's `onError`. */
  fullUrl: string;
  expiresIn: number;
  variant: 'full' | 'thumb';
}

/** One row of the school-wide trace, joined to the person it belongs to. */
export interface PersonDocumentReportRow {
  id: number;
  userId: number;
  owner: PersonDocumentOwner;
  docType: PersonDocumentType;
  status: PersonDocumentStatus;
  fileName: string | null;
  notes: string | null;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  studentId: number | null;
  classId: number | null;
  sectionId: number | null;
}

export interface PersonDocumentReport {
  data: PersonDocumentReportRow[];
  total: number;
  page: number;
  limit: number;
}

export interface PersonDocumentReportQuery {
  status?: PersonDocumentStatus;
  docType?: PersonDocumentType;
  owner?: PersonDocumentOwner;
  role?: string;
  classId?: number;
  page?: number;
  /** The API caps this at 100. */
  limit?: number;
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

/**
 * Display order is the order the office asks for the papers in, not
 * alphabetical: identity first, then school history, then entitlement proofs.
 */
export const DOCUMENT_TYPES: { value: PersonDocumentType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'BIRTH_CERTIFICATE', label: 'Birth certificate' },
  { value: 'TRANSFER_CERTIFICATE', label: 'Transfer certificate' },
  { value: 'PREVIOUS_MARKSHEET', label: 'Previous marksheet' },
  { value: 'ADDRESS_PROOF', label: 'Address proof' },
  { value: 'PAN', label: 'PAN' },
  { value: 'INCOME_CERTIFICATE', label: 'Income certificate' },
  { value: 'CASTE_CERTIFICATE', label: 'Caste certificate' },
  { value: 'PHOTO', label: 'Passport photo' },
  { value: 'OTHER', label: 'Other' },
];

export const DOCUMENT_TYPE_LABEL: Record<PersonDocumentType, string> =
  DOCUMENT_TYPES.reduce(
    (acc, d) => {
      acc[d.value] = d.label;
      return acc;
    },
    {} as Record<PersonDocumentType, string>,
  );

export const OWNER_LABEL: Record<PersonDocumentOwner, string> = {
  SELF: 'Own',
  FATHER: "Father's",
  MOTHER: "Mother's",
  GUARDIAN: "Guardian's",
};

export const PHOTO_KIND_TO_OWNER: Record<PhotoKind, PersonDocumentOwner> = {
  self: 'SELF',
  father: 'FATHER',
  mother: 'MOTHER',
  guardian: 'GUARDIAN',
};

/** Status word shown in the UI. "On file" is clearer than "Uploaded". */
export const DOCUMENT_STATUS_LABEL: Record<PersonDocumentStatus, string> = {
  PENDING: 'Pending',
  COLLECTED: 'Collected',
  UPLOADED: 'On file',
};

/* ── Limits (mirrors of the server's, so errors surface before the round trip) */

/** Checklist attachments. The server rejects anything larger. */
export const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES =
  'application/pdf,image/jpeg,image/png,image/webp';

/* ── Transport ──────────────────────────────────────────────────────────── */

export class PersonDocumentsError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.name = 'PersonDocumentsError';
    this.status = status;
    this.info = info;
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; form?: FormData } = {},
): Promise<T> {
  const res = await authFetch(`${base()}/person-documents${path}`, {
    method,
    // authFetch strips its JSON Content-Type when the body is FormData, so the
    // browser can set the multipart boundary itself.
    body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  if (!res.ok) {
    const info = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const raw = info?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : raw;
    throw new PersonDocumentsError(
      message || 'That request did not go through.',
      res.status,
      info,
    );
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ── Photos ─────────────────────────────────────────────────────────────── */

/**
 * Upload a cropped photo. `thumbnail` is optional but should always be sent —
 * it is what keeps every later read small. The server stores it at a key
 * derived from the full image's.
 */
export function uploadPersonPhoto(
  userId: number,
  kind: PhotoKind,
  full: Blob,
  thumbnail?: Blob | null,
): Promise<PhotoUploadResult> {
  const form = new FormData();
  form.append('file', full, `photo.${blobExtension(full)}`);
  if (thumbnail) {
    form.append('thumbnail', thumbnail, `photo-thumb.${blobExtension(thumbnail)}`);
  }
  return request<PhotoUploadResult>('POST', `/photo/${userId}?kind=${kind}`, { form });
}

/**
 * Signed URL for a photo. Ask for `thumb` anywhere the photo renders small;
 * the response still carries `fullUrl` for the `onError` swap, which covers
 * photos uploaded before thumbnails existed.
 *
 * Resolves to `null` when the person has no photo in that slot — a missing
 * photo is an ordinary state, not an error the caller should have to catch.
 */
export async function getPersonPhotoUrl(
  userId: number,
  kind: PhotoKind,
  variant: 'full' | 'thumb' = 'thumb',
): Promise<PhotoUrlResult | null> {
  try {
    return await request<PhotoUrlResult>(
      'GET',
      `/photo/${userId}/url?kind=${kind}&variant=${variant}`,
    );
  } catch (err) {
    if (err instanceof PersonDocumentsError && err.status === 404) return null;
    throw err;
  }
}

export function deletePersonPhoto(
  userId: number,
  kind: PhotoKind,
): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>('DELETE', `/photo/${userId}?kind=${kind}`);
}

/* ── Checklist ──────────────────────────────────────────────────────────── */

export function listPersonDocuments(userId: number): Promise<PersonDocument[]> {
  return request<PersonDocument[]>('GET', `/user/${userId}`);
}

/**
 * Create or update one checklist row, keyed on (userId, owner, docType).
 *
 * Two server rules the UI has to respect rather than discover:
 *   · `status: 'UPLOADED'` is refused — it belongs to the file endpoints.
 *   · any status change is refused while a file is attached; remove the file
 *     first.
 */
export function upsertPersonDocument(body: {
  userId: number;
  owner?: PersonDocumentOwner;
  docType: PersonDocumentType;
  status?: Exclude<PersonDocumentStatus, 'UPLOADED'>;
  notes?: string;
}): Promise<PersonDocument> {
  return request<PersonDocument>('PUT', '', { body });
}

/** Attaching a file is what moves a row to UPLOADED. */
export function attachPersonDocumentFile(
  id: number,
  file: File,
): Promise<PersonDocument> {
  const form = new FormData();
  form.append('file', file, file.name);
  return request<PersonDocument>('POST', `/${id}/file`, { form });
}

export function getPersonDocumentFileUrl(
  id: number,
): Promise<{ url: string; expiresIn: number }> {
  return request<{ url: string; expiresIn: number }>('GET', `/${id}/url`);
}

/** Drops the scan. The row survives as COLLECTED — the paper is still held. */
export function deletePersonDocumentFile(id: number): Promise<PersonDocument> {
  return request<PersonDocument>('DELETE', `/${id}/file`);
}

/* ── Report ─────────────────────────────────────────────────────────────── */

export function getPersonDocumentReport(
  query: PersonDocumentReportQuery = {},
): Promise<PersonDocumentReport> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return request<PersonDocumentReport>('GET', `/report${qs ? `?${qs}` : ''}`);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * The user id behind a student or staff record.
 *
 * Every `/person-documents` route is keyed on the USER id, while the students
 * and staff endpoints flatten the user onto the record and keep `id` as the
 * student/staff id. `userId` is the field that carries the difference.
 */
export function personUserId(record: unknown): number | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as { userId?: unknown; user?: { id?: unknown } };
  const candidate = r.userId ?? r.user?.id;
  return typeof candidate === 'number' ? candidate : null;
}

/** Does this record already have a photo in the given slot? */
export function hasPhotoFor(record: unknown, kind: PhotoKind): boolean {
  if (!record || typeof record !== 'object') return false;
  const column = (
    {
      self: 'photoS3Key',
      father: 'fatherPhotoS3Key',
      mother: 'motherPhotoS3Key',
      guardian: 'guardianPhotoS3Key',
    } as const
  )[kind];
  return Boolean((record as Record<string, unknown>)[column]);
}

function blobExtension(blob: Blob): string {
  if (blob.type === 'image/png') return 'png';
  if (blob.type === 'image/jpeg') return 'jpg';
  return 'webp';
}
