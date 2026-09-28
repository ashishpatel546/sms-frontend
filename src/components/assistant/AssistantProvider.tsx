'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';

/** Staff and admins only in phase 1 — never parents or students. */
const STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HR_ADMIN',
  'SUB_ADMIN',
  'LIBRARIAN',
  'TEACHER',
  'GUARD',
]);

/** How long a "may I use the assistant" answer is trusted before asking again. */
const ACCESS_TTL_MS = 5 * 60_000;

/**
 * Whether the school's admins let this person use the assistant
 * (`GET /agent/access`). Asked on load and again when the tab comes back
 * after a while, so a change by an admin shows without a reload. Unknown
 * (still loading, or the check failed) counts as allowed: sms-backend refuses
 * anyone without access anyway, and the panel then says so.
 */
function usePersonalAccess(check: boolean): boolean {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    if (!check) return;
    let last = 0;
    let cancelled = false;
    const ask = () => {
      if (Date.now() - last < ACCESS_TTL_MS) return;
      last = Date.now();
      authFetch(`${API_BASE_URL}/agent/access`)
        .then((r) => (r.ok ? r.json() : null))
        .then((a: { allowed?: boolean } | null) => {
          if (!cancelled && a && typeof a.allowed === 'boolean') setAllowed(a.allowed);
        })
        .catch(() => undefined);
    };
    ask();
    const onVisible = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);
  return allowed;
}

interface AssistantContextValue {
  /** The school has the assistant and this person may use it. */
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const AssistantContext = createContext<AssistantContextValue>({
  available: false,
  open: false,
  setOpen: () => undefined,
  toggle: () => undefined,
});

export function useAssistant() {
  return useContext(AssistantContext);
}

export function AssistantProvider({
  role,
  roles,
  children,
}: {
  role?: string;
  roles?: string[];
  children: React.ReactNode;
}) {
  const { enabled } = useFeatureFlag('ai_agent');
  const isStaff = [role, ...(roles ?? [])].some((r) => !!r && STAFF_ROLES.has(r));
  const allowed = usePersonalAccess(enabled === true && isStaff);
  const available = enabled === true && isStaff && allowed;
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Ctrl/⌘ + J opens and closes the assistant from anywhere in the app.
  useEffect(() => {
    if (!available) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available]);

  const value = useMemo(
    () => ({ available, open: available && open, setOpen, toggle }),
    [available, open, toggle],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
