'use client';

import * as React from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

/* ═══════════════════════════════════════════════════════════════════════════
   WHO PERMITTED THIS

   Money given away — a counter discount, a waived balance — has to name the
   person who allowed it, and that name has to be right, because the whole
   point of the field is that somebody can be asked about it later.

   Deliberately NOT `StaffPicker`: that component answers with a *staff* id,
   and both `discountPermittedByUserId` and `permittedByUserId` are *user*
   ids. The two sequences overlap, so passing one where the other is expected
   does not fail — it silently records a different, real person as the
   authoriser. This searches `/users?staffOnly=true`, exactly as the fee
   waive-off flow does, so the id handed back is the one the column means.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AuthorizerResult {
  id: number;
  firstName: string;
  lastName: string;
  role?: string;
  designation?: { title?: string };
}

interface Props {
  value: number | null;
  onChange: (userId: number | null, user: AuthorizerResult | null) => void;
  placeholder?: string;
  className?: string;
}

export default function AuthorizerPicker({
  value,
  onChange,
  placeholder = 'Search staff by name…',
  className = '',
}: Props) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<AuthorizerResult[]>([]);
  const [selected, setSelected] = React.useState<AuthorizerResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // The parent clearing `value` (a form reset after a saved sale) has to clear
  // the chip too, or the next sale shows the last one's authoriser.
  React.useEffect(() => {
    if (value == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(null);
    }
  }, [value]);

  const search = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/users?staffOnly=true&name=${encodeURIComponent(q.trim())}&limit=10`,
      );
      if (res.ok) {
        const data = await res.json();
        const list: AuthorizerResult[] = Array.isArray(data) ? data : (data?.data ?? []);
        setResults(list);
        setOpen(list.length > 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (selected) {
      setSelected(null);
      onChange(null, null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(val), 300);
  };

  const pick = (user: AuthorizerResult) => {
    setSelected(user);
    setQuery('');
    setOpen(false);
    setResults([]);
    onChange(user.id, user);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(null, null);
  };

  const roleLabel = (u: AuthorizerResult) =>
    u.designation?.title ?? u.role?.replace(/_/g, ' ').toLowerCase() ?? '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-brand-tint px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-[12px] text-ink-muted capitalize">{roleLabel(selected)}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            className="shrink-0 text-ink-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 pr-8 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none"
          />
          {loading && (
            <div className="absolute top-1/2 right-2.5 -translate-y-1/2">
              <div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
          )}
        </div>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-soft">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => pick(u)}
                className="w-full px-3.5 py-2 text-left transition-colors hover:bg-brand-tint"
              >
                <p className="text-[13.5px] font-medium text-ink">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-[12px] text-ink-muted capitalize">{roleLabel(u)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
