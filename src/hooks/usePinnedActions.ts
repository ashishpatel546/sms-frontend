import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dashboard-pinned-actions';

export const defaultPinnedActions = [
  '/dashboard/attendance',
  '/dashboard/notifications',
  '/dashboard/homework',
];

export function usePinnedActions() {
  const [pinned, setPinned] = useState<string[]>(defaultPinnedActions);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPinned(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoaded(true);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setPinned(JSON.parse(e.newValue));
      }
    };

    const handleLocalChange = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setPinned(JSON.parse(saved));
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pinned-actions-changed', handleLocalChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pinned-actions-changed', handleLocalChange);
    };
  }, []);

  const togglePin = (href: string) => {
    setPinned((prev) => {
      const next = prev.includes(href)
        ? prev.filter((h) => h !== href)
        : [...prev, href];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        // Dispatch event asynchronously to avoid React warnings about updating
        // other components during the current render phase.
        setTimeout(() => {
          window.dispatchEvent(new Event('pinned-actions-changed'));
        }, 0);
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { pinned, togglePin, isLoaded };
}
