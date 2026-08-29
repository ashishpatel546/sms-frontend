'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   CIRCULARS — the client half of `sms-backend/src/modules/circulars`.

   A circular is issued once and never edited, so there is no update or delete
   call here by design: the API has none. A correction is a new circular.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Mirrors the server-side caps in `circular.entity.ts` — keep the two in step. */
export const CIRCULAR_TITLE_MAX = 150;
export const CIRCULAR_DESCRIPTION_MAX = 2000;
export const CIRCULAR_DESCRIPTION_MIN = 10;
export const CIRCULAR_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** The list opens on the five most recent — the server's default page size. */
export const CIRCULAR_PAGE_SIZE = 5;

export interface Circular {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  createdByName: string | null;
  createdAt: string;
  /** Set only on archived circulars, and only a super admin ever sees one. */
  archivedAt: string | null;
  archiveReason: string | null;
}

export interface PaginatedCirculars {
  data: Circular[];
  total: number;
  page: number;
  limit: number;
}

export interface CircularQuery {
  search?: string;
  page?: number;
  limit?: number;
  /**
   * Honoured for SUPER_ADMIN only — the API resolves it against the caller's
   * role, so sending it as anyone else changes nothing.
   */
  includeArchived?: boolean;
}

export class CircularApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CircularApiError';
  }
}

function buildQuery(query: CircularQuery): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.includeArchived) params.set('includeArchived', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new CircularApiError(message ?? 'The request failed', res.status);
  }
  return (await res.json()) as T;
}

export function fetchCirculars(query: CircularQuery = {}): Promise<PaginatedCirculars> {
  return getJson(`/circulars${buildQuery(query)}`);
}

export function fetchCircular(id: string): Promise<Circular> {
  return getJson(`/circulars/${id}`);
}

/** A 15-minute signed S3 URL — good for rendering the PDF inline. */
export function fetchCircularFileUrl(
  id: string,
): Promise<{ url: string; fileName: string; mimeType: string }> {
  return getJson(`/circulars/${id}/file`);
}

/**
 * Saves the attachment under its own name.
 *
 * It goes through the API rather than the signed S3 URL on purpose: the
 * private bucket sends no CORS headers, so the browser cannot read those bytes
 * — and a cross-origin `<a download>` is ignored, which would navigate the
 * reader away to S3 instead of handing them a file.
 */
export async function downloadCircularFile(id: string, fileName: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/circulars/${id}/download`);
  if (!res.ok) throw new CircularApiError('Could not download the attachment', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Issues a circular. Multipart because the PDF rides along; `authFetch` drops
 * its JSON Content-Type when the body is FormData so the browser can set the
 * boundary itself.
 */
export async function createCircular(input: {
  title: string;
  description: string;
  file?: File | null;
}): Promise<Circular> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description);
  if (input.file) form.append('file', input.file);

  const res = await authFetch(`${API_BASE_URL}/circulars`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new CircularApiError(message ?? 'The circular could not be issued', res.status);
  }
  return (await res.json()) as Circular;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(b.message) ? b.message[0] : b.message;
    throw new CircularApiError(message ?? 'The request failed', res.status);
  }
  return (await res.json()) as T;
}

/**
 * Withdraws a circular from the school's view. SUPER_ADMIN only.
 *
 * Not an edit and not a delete: the text, the attachment and the row all stay
 * exactly as issued — only who can see it changes. The in-app notification
 * raised at publication is withdrawn along with it; a web push already shown
 * on a device is the one part that cannot be taken back.
 */
export function archiveCircular(id: string, reason?: string): Promise<Circular> {
  return postJson(`/circulars/${id}/archive`, reason ? { reason } : {});
}

/**
 * Puts an archived circular back in front of the school, and announces it
 * again — archiving withdrew the original notification, so a restored
 * circular that stayed silent would be live but unannounced. SUPER_ADMIN only.
 */
export function restoreCircular(id: string): Promise<Circular> {
  return postJson(`/circulars/${id}/restore`);
}

/* ── Display helpers ──────────────────────────────────────────────────── */

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPublishedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
