'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const available = enabled === true && isStaff;
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
