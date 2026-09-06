'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITIES — the client half of `sms-backend/src/modules/activities`.

   Mirrors the shapes the backend actually returns. List endpoints are
   paginated as { data, total, page, limit } — no unbounded fetches here.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ActivityCategory =
  | 'SPORTS'
  | 'CULTURAL'
  | 'ACADEMIC'
  | 'COMPETITION'
  | 'EXCURSION'
  | 'CELEBRATION'
  | 'SOCIAL_SERVICE'
  | 'OTHER';

export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  'SPORTS', 'CULTURAL', 'ACADEMIC', 'COMPETITION', 'EXCURSION', 'CELEBRATION', 'SOCIAL_SERVICE', 'OTHER',
];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  SPORTS: 'Sports',
  CULTURAL: 'Cultural',
  ACADEMIC: 'Academic',
  COMPETITION: 'Competition',
  EXCURSION: 'Excursion',
  CELEBRATION: 'Celebration',
  SOCIAL_SERVICE: 'Social Service',
  OTHER: 'Other',
};

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  startDate: string;
  endDate: string | null;
  venue: string | null;
  status: ActivityStatus;
  remarks: string | null;
  resultSummary: string | null;
  academicSessionId: number | null;
  participantCount: number;
  winnerCount: number;
  photoCount: number;
  coverPhotoId: number | null;
  notificationId: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdById: number;
  updatedById: number | null;
  createdAt: string;
  updatedAt: string;
  participants?: ActivityParticipant[];
}

export interface ActivityParticipant {
  id: number;
  activityId: string;
  studentId: number;
  isWinner: boolean;
  position: number | null;
  award: string | null;
  remark: string | null;
  student?: {
    id: number;
    firstName?: string;
    lastName?: string;
    admissionNumber?: string | null;
    user?: { firstName: string; lastName: string };
  };
}

export interface ActivityPhoto {
  id: number;
  activityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export class ActivitiesApiError extends Error {
  readonly status: number;
  readonly featureDisabled: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ActivitiesApiError';
    this.status = status;
    this.featureDisabled = status === 403 && /not enabled/i.test(message);
  }
}

function buildQuery<T extends object>(params: T): string {
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
    throw new ActivitiesApiError(body.message ?? 'The request failed', res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function putJson<T>(path: string, body: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteJson<T>(path: string): Promise<T> {
  return getJson<T>(path, { method: 'DELETE' });
}

/* ── Activities ────────────────────────────────────────────────────────── */

export interface ActivityQuery {
  status?: ActivityStatus;
  category?: ActivityCategory;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function fetchActivities(query: ActivityQuery): Promise<Paginated<Activity>> {
  return getJson(`/activities${buildQuery(query)}`);
}

export function fetchActivity(id: string): Promise<Activity> {
  return getJson(`/activities/${id}`);
}

export interface CreateActivityInput {
  title: string;
  description: string;
  category?: ActivityCategory;
  startDate: string;
  endDate?: string;
  venue?: string;
  academicSessionId?: number;
  remarks?: string;
}

export function createActivity(dto: CreateActivityInput): Promise<Activity> {
  return postJson('/activities', dto);
}

export function updateActivity(
  id: string,
  dto: Partial<CreateActivityInput> & { resultSummary?: string },
): Promise<Activity> {
  return patchJson(`/activities/${id}`, dto);
}

export function deleteActivity(id: string): Promise<void> {
  return deleteJson(`/activities/${id}`);
}

export function publishActivity(id: string, notifyAgain = true): Promise<Activity> {
  return postJson(`/activities/${id}/publish`, { notifyAgain });
}

export function notifyAgainActivity(id: string): Promise<Activity> {
  return postJson(`/activities/${id}/notify-again`);
}

export function archiveActivity(id: string): Promise<Activity> {
  return postJson(`/activities/${id}/archive`);
}

export function unarchiveActivity(id: string): Promise<Activity> {
  return postJson(`/activities/${id}/unarchive`);
}

/* ── Participants ──────────────────────────────────────────────────────── */

export interface ParticipantEntryInput {
  studentId: number;
  isWinner?: boolean;
  position?: number;
  award?: string;
  remark?: string;
}

export function setParticipants(
  id: string,
  participants: ParticipantEntryInput[],
): Promise<Activity> {
  return putJson(`/activities/${id}/participants`, { participants });
}

export async function downloadParticipantsCsv(id: string, activityTitle: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/activities/${id}/participants/export`);
  if (!res.ok) throw new ActivitiesApiError('Could not export participants', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activityTitle.replace(/[^a-zA-Z0-9 _-]/g, '_')}-participants.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ── Photos ────────────────────────────────────────────────────────────── */

export function fetchActivityPhotos(id: string): Promise<ActivityPhoto[]> {
  return getJson(`/activities/${id}/photos`);
}

export async function fetchActivityPhotoUrls(
  id: string,
  ids: number[],
  variant: 'thumb' | 'full' = 'thumb',
): Promise<Record<number, string>> {
  if (!ids.length) return {};
  return getJson(`/activities/${id}/photo-urls${buildQuery({ ids: ids.join(','), variant })}`);
}

export async function uploadActivityPhoto(
  id: string,
  file: Blob,
  fileName: string,
  thumbnail?: Blob,
  caption?: string,
): Promise<ActivityPhoto> {
  const form = new FormData();
  form.append('file', file, fileName);
  if (thumbnail) form.append('thumbnail', thumbnail, `thumb-${fileName}`);
  if (caption) form.append('caption', caption);
  const res = await authFetch(`${API_BASE_URL}/activities/${id}/photos`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ActivitiesApiError(body.message ?? 'Upload failed', res.status);
  }
  return res.json();
}

export function updateActivityPhoto(
  id: string,
  photoId: number,
  dto: { caption?: string },
): Promise<ActivityPhoto> {
  return patchJson(`/activities/${id}/photos/${photoId}`, dto);
}

export function deleteActivityPhoto(id: string, photoId: number): Promise<{ success: true }> {
  return deleteJson(`/activities/${id}/photos/${photoId}`);
}

export function reorderActivityPhotos(
  id: string,
  order: { id: number; sortOrder: number }[],
): Promise<{ success: true }> {
  return putJson(`/activities/${id}/photos/reorder`, { order });
}

export function setCoverPhoto(id: string, photoId: number): Promise<Activity> {
  return postJson(`/activities/${id}/photos/${photoId}/cover`);
}

/* ── Parent portal ─────────────────────────────────────────────────────── */

export function fetchStudentActivities(
  studentId: string | number,
  page = 1,
  limit = 20,
): Promise<Paginated<Activity>> {
  return getJson(`/parent/student/${studentId}/activities${buildQuery({ page, limit })}`);
}

export function fetchStudentActivity(studentId: string | number, activityId: string): Promise<Activity> {
  return getJson(`/parent/student/${studentId}/activities/${activityId}`);
}

export function fetchStudentActivityPhotos(
  studentId: string | number,
  activityId: string,
): Promise<ActivityPhoto[]> {
  return getJson(`/parent/student/${studentId}/activities/${activityId}/photos`);
}

/** Extracts a human-readable message from a caught error, for toast.error(). */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function fetchStudentActivityPhotoUrls(
  studentId: string | number,
  activityId: string,
  ids: number[],
  variant: 'thumb' | 'full' = 'thumb',
): Promise<Record<number, string>> {
  if (!ids.length) return {};
  return getJson(
    `/parent/student/${studentId}/activities/${activityId}/photo-urls${buildQuery({ ids: ids.join(','), variant })}`,
  );
}
