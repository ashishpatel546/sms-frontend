'use client';

import { useEffect, useRef } from 'react';

import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { crewApp, useCrewAppStatus } from './crewApp';

const ASKED_KEY = 'crew-push-asked';

/**
 * Notifications inside the crew app. A WebView cannot take web push, so the
 * app hands over its Firebase token and this saves it as the user's push
 * subscription (`fcm:<token>`); sms-backend then sends the same notices to
 * it. Saved on every portal load (the server keeps one row per token, last
 * login wins); logout removes it (push-notifications.ts). Renders nothing.
 */
export function CrewAppPush() {
  const status = useCrewAppStatus();
  const saved = useRef<string | null>(null);

  // Ask for the notification permission once per install.
  useEffect(() => {
    const app = crewApp();
    if (!app) return;
    let asked = false;
    try {
      asked = localStorage.getItem(ASKED_KEY) === '1';
      localStorage.setItem(ASKED_KEY, '1');
    } catch {
      // Storage unavailable: asking again is harmless.
    }
    if (!asked) app.enablePush();
  }, []);

  const token = status?.pushToken ?? null;
  useEffect(() => {
    if (!token || saved.current === token) return;
    saved.current = token;
    authFetch(`${API_BASE_URL}/api/app-notifications/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: `fcm:${token}`, keys: { p256dh: '', auth: '' } }),
    }).catch(() => {
      saved.current = null;
    });
  }, [token]);

  return null;
}
