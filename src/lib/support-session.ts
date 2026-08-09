'use client';

import { useSyncExternalStore } from 'react';
import { getToken } from './auth';

/**
 * Platform support sessions (sms-hub operators entering a school with a
 * one-time ticket) carry extra claims in the access token, minted by
 * sms-backend's `loginPlatformOperator`:
 *
 *   platform: true
 *   ticketMode: 'READ_ONLY' | 'READ_WRITE'
 *
 * The server enforces the mode on every request (`PlatformSessionGuard`
 * rejects non-GET traffic on a READ_ONLY session with a 403). Everything in
 * this file is presentation: telling the operator they are read-only BEFORE
 * they fill in a form, instead of after the submit bounces.
 */
export interface SupportSession {
  /** True only for ticket-issued platform sessions, never for school users. */
  active: boolean;
  /** True when the ticket was issued READ_ONLY, so every write will 403. */
  readOnly: boolean;
}

export function getSupportSession(): SupportSession {
  const token = getToken();
  if (!token) return { active: false, readOnly: false };
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      platform?: boolean;
      ticketMode?: string;
    };
    const active = payload.platform === true;
    return {
      active,
      // Fail toward "read-only" for a platform session with a missing or
      // unknown mode — the server will refuse the write anyway, so the UI
      // should not promise otherwise.
      readOnly: active && payload.ticketMode !== 'READ_WRITE',
    };
  } catch {
    return { active: false, readOnly: false };
  }
}

// A support-session token cannot change mid-session (60-minute token, no
// refresh), so there is nothing to subscribe to — the store is effectively
// constant for the life of the tab.
const subscribeNever = () => () => {};
const readOnlySnapshot = () => getSupportSession().readOnly;
const serverSnapshot = () => false;

/**
 * True when the current session is a read-only support session.
 *
 * `false` on the server and during hydration (the token lives in
 * localStorage), correct from the first client render after that. The safe
 * direction: the server rejects the write regardless; this hook only exists
 * to say so up front.
 */
export function useReadOnlySession(): boolean {
  return useSyncExternalStore(subscribeNever, readOnlySnapshot, serverSnapshot);
}

/** The title/tooltip to put on controls disabled by a read-only session. */
export const READ_ONLY_TITLE =
  'Read-only support session — viewing only. Ask for a read-write ticket to make changes.';
