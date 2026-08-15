'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

export interface StudentResult {
  id: number;
  firstName: string;
  lastName: string;
  mobile?: string;
  class?: { name: string };
  section?: { name: string };
}

interface Props {
  value: number | null;
  onChange: (studentId: number | null, student: StudentResult | null) => void;
  placeholder?: string;
  className?: string;
}

/** Same shape as StaffPicker, aimed at /students instead of /staff. */
export default function StudentPicker({
  value,
  onChange,
  placeholder = 'Search by name or mobile…',
  className = '',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (value && !selected) {
      authFetch(`${API_BASE_URL}/students?id=${value}&page=1&limit=1`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const item = data?.data?.[0] ?? (Array.isArray(data) ? data[0] : null);
          if (item) setSelected(item);
        })
        .catch(() => {});
    }
    if (!value) {
      // Clearing local state in response to the controlled `value` prop
      // being reset from outside (e.g. the sell page resetting the form).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(null);
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      // `page` as well as `limit`: /students only paginates when it sees BOTH,
      // and without it a single-letter query answers with every matching
      // student in the school — a hundred-row dropdown on a phone at the
      // counter, and a hundred rows of payload to get there.
      const isMobile = /^\d+$/.test(q.trim());
      const params = isMobile
        ? `mobile=${encodeURIComponent(q.trim())}&page=1&limit=10`
        : `search=${encodeURIComponent(q.trim())}&page=1&limit=10`;
      const res = await authFetch(`${API_BASE_URL}/students?${params}`);
      if (res.ok) {
        const data = await res.json();
        const list: StudentResult[] = data?.data ?? (Array.isArray(data) ? data : []);
        setResults(list);
        setOpen(list.length > 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (selected) {
      setSelected(null);
      onChange(null, null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (student: StudentResult) => {
    setSelected(student);
    setQuery('');
    setOpen(false);
    setResults([]);
    onChange(student.id, student);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(null, null);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-brand-tint px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-[12px] text-ink-muted">
              {/* Class names already read "Class 9" — prefixing gives "Class Class 9". */}
              {selected.class?.name ?? ''}
              {selected.section?.name ? ` · ${selected.section.name}` : ''}
              {selected.mobile ? ` · ${selected.mobile}` : ''}
            </p>
          </div>
          <button type="button" onClick={handleClear} className="shrink-0 text-ink-faint hover:text-ink">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
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
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full px-3.5 py-2 text-left transition-colors hover:bg-brand-tint"
              >
                <p className="text-[13.5px] font-medium text-ink">{s.firstName} {s.lastName}</p>
                <p className="text-[12px] text-ink-muted">
                  {s.class?.name ?? ''}
                  {s.section?.name ? ` · ${s.section.name}` : ''}
                  {s.mobile ? ` · ${s.mobile}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
