'use client';

/**
 * Admin Panel → AI Assistant: who in the school may use the assistant, how
 * many of the school's monthly credits each person may spend, and who used
 * how much. Everything here is also enforced by sms-backend; the page only
 * shows and edits it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { Pencil, Search, Sparkles, Users } from 'lucide-react';
import { API_BASE_URL, fetcher } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { READ_ONLY_TITLE, useReadOnlySession } from '@/lib/support-session';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Note, Panel } from '@/components/ui/Panel';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { roleLabel } from './RoleManagerDialog';

type AccessMode = 'ALL_STAFF' | 'SELECTED';
type AccessChoice = 'DEFAULT' | 'ALLOWED' | 'BLOCKED';
type LimitMode = 'DEFAULT' | 'NONE' | 'CUSTOM';

interface Person {
  id: number;
  name: string;
  role: string;
  roles: string[];
  designation: string | null;
  active: boolean;
  tier: 'SUPER_ADMIN' | 'STAFF';
  access: AccessChoice;
  limitMode: LimitMode;
  monthlyCredits: number | null;
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  calls: number;
  sessions: number;
  lastUsedAt: string | null;
  /** False for yourself and for Super Admins (always full access). */
  canEdit: boolean;
}

interface ListResponse {
  month: string;
  settings: { mode: AccessMode; defaultUserCredits: number | null };
  quota: { limit: number; used: number; remaining: number };
  summary: { staff: number; withAccess: number; withLimit: number; usedByStaff: number };
  total: number;
  users: Person[];
}

interface Usage {
  byDay: { day: string; credits: number; events: number }[];
  byTool: { kind: string; name: string; credits: number; calls: number }[];
}

const n = (v: number) => v.toLocaleString('en-IN');

function thisMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function lastUsed(at: string | null) {
  if (!at) return '—';
  return new Date(at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Tool names as sms-mcp sends them ("attendance_register") → words. */
function toolLabel(kind: string, name: string) {
  if (kind === 'LLM') return 'Writing answers';
  if (kind === 'STT') return 'Listening (voice)';
  if (kind === 'TTS') return 'Speaking (voice)';
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function readMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  const m = Array.isArray(body.message) ? body.message.join('; ') : body.message;
  return m || fallback;
}

function limitText(p: Person, schoolCap: number | null) {
  if (p.tier === 'SUPER_ADMIN') return 'No limit';
  if (p.limitMode === 'CUSTOM') return `${n(p.monthlyCredits ?? 0)} / month`;
  if (p.limitMode === 'NONE') return 'No limit';
  return schoolCap === null ? 'No limit' : `${n(schoolCap)} / month (school)`;
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null || limit <= 0) {
    return <span className="font-mono tabular-nums text-ink">{n(used)}</span>;
  }
  const share = Math.min(1, used / limit);
  return (
    <div className="min-w-28">
      <span className="font-mono tabular-nums text-ink">
        {n(used)} <span className="text-ink-faint">of {n(limit)}</span>
      </span>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-inset">
        <div
          className={cn(
            'h-full rounded-full',
            share >= 1 ? 'bg-accent-danger' : share >= 0.8 ? 'bg-accent' : 'bg-brand',
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

function Choice({
  checked,
  onChange,
  disabled,
  title,
  hint,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        checked ? 'border-brand bg-brand-tint' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        className="mt-0.5 accent-brand"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        {hint && <span className="block text-[12.5px] text-ink-muted">{hint}</span>}
        {children}
      </span>
    </label>
  );
}

// ── School settings ─────────────────────────────────────────────────────────

function SettingsPanel({
  settings,
  readOnly,
  onSaved,
}: {
  settings: ListResponse['settings'];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<AccessMode>(settings.mode);
  const [capOn, setCapOn] = useState(settings.defaultUserCredits !== null);
  const [cap, setCap] = useState(String(settings.defaultUserCredits ?? 100));
  const [saving, setSaving] = useState(false);

  const capValue = capOn ? Number(cap) : null;
  const invalid = capOn && (!Number.isInteger(capValue) || (capValue ?? 0) < 0);
  const dirty = mode !== settings.mode || capValue !== settings.defaultUserCredits;

  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/agent/access-control/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ mode, defaultUserCredits: capValue }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save.'));
      toast.success('AI Assistant settings saved');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Who can use it
          </p>
          <div className="space-y-2">
            <Choice
              checked={mode === 'ALL_STAFF'}
              onChange={() => setMode('ALL_STAFF')}
              disabled={readOnly}
              title="All staff"
              hint="Everyone except people you block below."
            />
            <Choice
              checked={mode === 'SELECTED'}
              onChange={() => setMode('SELECTED')}
              disabled={readOnly}
              title="Only people I choose"
              hint="Turn it on person by person below, admins included. Super Admins always have access."
            />
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Monthly limit per person
          </p>
          <div className="space-y-2">
            <Choice
              checked={!capOn}
              onChange={() => setCapOn(false)}
              disabled={readOnly}
              title="No limit"
              hint="Anyone with access can use the school's credits until they run out."
            />
            <Choice
              checked={capOn}
              onChange={() => setCapOn(true)}
              disabled={readOnly}
              title="Limit each person"
              hint="Applies to everyone without their own limit, admins included."
            >
              {capOn && (
                <span className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    disabled={readOnly}
                    className="h-9 w-28 rounded-md border border-line-strong bg-surface px-2 font-mono text-[13px] tabular-nums focus:border-brand focus:outline-none"
                  />
                  <span className="text-[12.5px] text-ink-muted">credits a month</span>
                </span>
              )}
            </Choice>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={!dirty || invalid || saving || readOnly}
          title={readOnly ? READ_ONLY_TITLE : undefined}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </Panel>
  );
}

// ── Edit one person, or several ─────────────────────────────────────────────

function EditDialog({
  people,
  month,
  schoolCap,
  mode,
  onClose,
  onSaved,
}: {
  people: Person[];
  month: string;
  schoolCap: number | null;
  mode: AccessMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const one = people.length === 1 ? people[0] : null;
  // Several people at once: only the limit (access has its own bulk buttons).
  const accessEditable = one?.canEdit ?? false;
  const [access, setAccess] = useState<AccessChoice>(one?.access ?? 'DEFAULT');
  const [limitMode, setLimitMode] = useState<LimitMode>(one?.limitMode ?? 'DEFAULT');
  const [credits, setCredits] = useState(String(one?.monthlyCredits ?? schoolCap ?? 100));
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (!one) return;
    authFetch(`${API_BASE_URL}/agent/access-control/users/${one.id}/usage?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [one, month]);

  const creditsValue = Number(credits);
  const invalid = limitMode === 'CUSTOM' && (!Number.isInteger(creditsValue) || creditsValue < 0);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        userIds: people.map((p) => p.id),
        limit: limitMode === 'CUSTOM' ? { mode: 'CUSTOM', credits: creditsValue } : { mode: limitMode },
      };
      if (accessEditable) body.access = access;
      const res = await authFetch(`${API_BASE_URL}/agent/access-control/users`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save.'));
      const r = (await res.json()) as { updated: number[]; skipped: { name: string; reason: string }[] };
      toast.success(r.updated.length === 1 ? 'Saved' : `Saved for ${r.updated.length} people`);
      for (const s of r.skipped.slice(0, 3)) toast(s.reason, { icon: 'ℹ️' });
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const followText =
    mode === 'ALL_STAFF' ? 'Follow school setting (allowed)' : 'Follow school setting (not allowed)';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{one ? one.name : `${people.length} people`}</DialogTitle>
        <DialogDescription>
          {one
            ? `${roleLabel(one.role)}${one.designation ? ` · ${one.designation}` : ''} — ${n(one.used)} credits used in ${monthLabel(month)}`
            : 'Sets the monthly limit for everyone selected. Anyone you cannot change is skipped.'}
        </DialogDescription>

        <div className="mt-2 space-y-5">
          {one && (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">Access</p>
            {!one.canEdit ? (
              <Note pigment="neutral">
                {one.tier === 'SUPER_ADMIN'
                  ? 'Super Admins always have access to the AI Assistant.'
                  : 'You cannot change your own access.'}
              </Note>
            ) : (
              <div className="space-y-2">
                <Choice checked={access === 'DEFAULT'} onChange={() => setAccess('DEFAULT')} title={followText} />
                <Choice checked={access === 'ALLOWED'} onChange={() => setAccess('ALLOWED')} title="Allowed" />
                <Choice
                  checked={access === 'BLOCKED'}
                  onChange={() => setAccess('BLOCKED')}
                  title="Not allowed"
                  hint="Their open conversation stops within a minute."
                />
              </div>
            )}
          </div>
          )}

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">Monthly limit</p>
            {one && !one.canEdit ? (
              <Note pigment="neutral">
                {one.tier === 'SUPER_ADMIN'
                  ? 'Super Admins have no limit.'
                  : 'You cannot change your own limit.'}
              </Note>
            ) : (
              <div className="space-y-2">
                <Choice
                  checked={limitMode === 'DEFAULT'}
                  onChange={() => setLimitMode('DEFAULT')}
                  title={schoolCap === null ? 'School setting (no limit)' : `School setting (${n(schoolCap)} a month)`}
                />
                <Choice checked={limitMode === 'NONE'} onChange={() => setLimitMode('NONE')} title="No limit" />
                <Choice
                  checked={limitMode === 'CUSTOM'}
                  onChange={() => setLimitMode('CUSTOM')}
                  title="Own limit"
                  hint="Counts from the 1st of each month."
                >
                  {limitMode === 'CUSTOM' && (
                    <span className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={credits}
                        onChange={(e) => setCredits(e.target.value)}
                        className="h-9 w-28 rounded-md border border-line-strong bg-surface px-2 font-mono text-[13px] tabular-nums focus:border-brand focus:outline-none"
                      />
                      <span className="text-[12.5px] text-ink-muted">credits a month</span>
                    </span>
                  )}
                </Choice>
              </div>
            )}
          </div>

          {one && usage && (usage.byTool.length > 0 || usage.byDay.length > 0) && (
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Where the credits went · {monthLabel(month)}
              </p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {usage.byTool.slice(0, 8).map((t) => (
                  <li key={`${t.kind}:${t.name}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate text-ink">{toolLabel(t.kind, t.name)}</span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-muted">
                      {n(t.credits)} <span className="text-ink-faint">· {n(t.calls)}×</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Used on {usage.byDay.length} {usage.byDay.length === 1 ? 'day' : 'days'} this month.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || invalid || (one !== null && !one.canEdit)}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────

export function AiAssistantAccess() {
  const readOnly = useReadOnlySession();
  const [month, setMonth] = useState(thisMonth);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'' | 'ALLOWED' | 'NOT_ALLOWED'>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Person[] | null>(null);

  const params = new URLSearchParams({ month, limit: '200' });
  if (filter) params.set('access', filter);
  const {
    data,
    error: loadError,
    isLoading: loading,
    mutate,
  } = useSWR<ListResponse>(`/agent/access-control/users?${params}`, fetcher, {
    keepPreviousData: true,
  });
  const error = loadError
    ? ((loadError as { info?: { message?: string } }).info?.message ??
      'Could not load AI Assistant access.')
    : null;
  const load = useCallback(() => void mutate(), [mutate]);

  const people = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.users ?? []).filter((p) => !term || p.name.toLowerCase().includes(term));
  }, [data, q]);

  const selectable = people.filter((p) => p.canEdit);
  const chosen = people.filter((p) => selected.has(p.id));
  const allChosen = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  const setAccessFor = async (p: Person, allowed: boolean) => {
    const res = await authFetch(`${API_BASE_URL}/agent/access-control/users`, {
      method: 'PATCH',
      body: JSON.stringify({ userIds: [p.id], access: allowed ? 'ALLOWED' : 'BLOCKED' }),
    });
    if (!res.ok) return toast.error(await readMessage(res, 'Could not change access.'));
    toast.success(`${p.name}: AI Assistant ${allowed ? 'allowed' : 'turned off'}`);
    void load();
  };

  const bulkAccess = async (access: AccessChoice) => {
    const res = await authFetch(`${API_BASE_URL}/agent/access-control/users`, {
      method: 'PATCH',
      body: JSON.stringify({ userIds: chosen.map((p) => p.id), access }),
    });
    if (!res.ok) return toast.error(await readMessage(res, 'Could not change access.'));
    const r = (await res.json()) as { updated: number[]; skipped: unknown[] };
    toast.success(
      `Updated ${r.updated.length}${r.skipped.length ? `, skipped ${r.skipped.length} (Super Admins or you)` : ''}`,
    );
    setSelected(new Set());
    void load();
  };

  const isCurrentMonth = month === thisMonth();
  const schoolCap = data?.settings.defaultUserCredits ?? null;

  if (error && !data) {
    return (
      <Panel>
        <EmptyState icon={<Sparkles />} title="AI Assistant access could not load" description={error} />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {data && (
        <StatGrid columns={4}>
          <StatTile
            label="School credits left"
            value={n(data.quota.remaining)}
            hint={`of ${n(data.quota.limit)} for ${monthLabel(data.month)}`}
            pigment={data.quota.remaining <= 0 ? 'danger' : data.quota.remaining < data.quota.limit * 0.1 ? 'attn' : 'ai'}
          />
          <StatTile
            label="Used by staff"
            value={n(data.summary.usedByStaff)}
            hint={`credits in ${monthLabel(data.month)}`}
            pigment="info"
          />
          <StatTile
            label="Staff with access"
            value={`${n(data.summary.withAccess)} / ${n(data.summary.staff)}`}
            hint={data.settings.mode === 'ALL_STAFF' ? 'All staff mode' : 'Only people you choose'}
            pigment="success"
          />
          <StatTile
            label="With a monthly limit"
            value={n(data.summary.withLimit)}
            hint={schoolCap === null ? 'No school-wide cap' : `School cap ${n(schoolCap)} a month`}
            pigment="neutral"
          />
        </StatGrid>
      )}

      {data && (
        // Keyed by the saved values, so it starts over from them after a save.
        <SettingsPanel
          key={`${data.settings.mode}:${data.settings.defaultUserCredits}`}
          settings={data.settings}
          readOnly={readOnly}
          onSaved={load}
        />
      )}

      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search staff by name"
              className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-[13.5px] focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13.5px] sm:flex-none"
              aria-label="Filter by access"
            >
              <option value="">Everyone</option>
              <option value="ALLOWED">Has access</option>
              <option value="NOT_ALLOWED">No access</option>
            </select>
            <input
              type="month"
              value={month}
              max={thisMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13.5px] sm:flex-none"
              aria-label="Month"
            />
          </div>
        </div>

        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-tint px-4 py-2.5">
            <span className="mr-1 text-[13px] font-semibold text-ink">{chosen.length} selected</span>
            <Button size="xs" variant="outline" onClick={() => bulkAccess('ALLOWED')} disabled={readOnly}>
              Allow
            </Button>
            <Button size="xs" variant="outline" onClick={() => bulkAccess('BLOCKED')} disabled={readOnly}>
              Turn off
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(chosen)} disabled={readOnly}>
              Set limit…
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : people.length === 0 ? (
          <EmptyState compact icon={<Users />} title="No staff match" description="Try another name or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-[13.5px]">
              <thead className="bg-surface-secondary font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allChosen}
                      onChange={() =>
                        setSelected(allChosen ? new Set() : new Set(selectable.map((p) => p.id)))
                      }
                    />
                  </th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Access</th>
                  <th className="px-3 py-2.5">Monthly limit</th>
                  <th className="px-3 py-2.5">Credits used</th>
                  <th className="px-3 py-2.5 text-right">Chats</th>
                  <th className="px-3 py-2.5">Last used</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p) => {
                  const canSelect = p.canEdit;
                  return (
                    <tr key={p.id} className={cn('hover:bg-surface-secondary/60', !p.active && 'opacity-60')}>
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          disabled={!canSelect}
                          checked={selected.has(p.id)}
                          onChange={() =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-ink">{p.name}</p>
                        <p className="text-[12px] text-ink-muted">
                          {roleLabel(p.role)}
                          {p.designation ? ` · ${p.designation}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.canEdit ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.allowed}
                            aria-label={`AI Assistant for ${p.name}`}
                            disabled={readOnly}
                            title={readOnly ? READ_ONLY_TITLE : p.access === 'DEFAULT' ? 'Follows the school setting' : undefined}
                            onClick={() => setAccessFor(p, !p.allowed)}
                            className={cn(
                              'relative h-5 w-9 rounded-full transition-colors disabled:opacity-50',
                              p.allowed ? 'bg-brand' : 'bg-line-strong',
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
                                p.allowed ? 'left-4.5' : 'left-0.5',
                              )}
                            />
                          </button>
                        ) : (
                          <StatusChip
                            pigment={p.allowed ? 'success' : 'neutral'}
                            label={p.tier === 'SUPER_ADMIN' ? 'Always' : p.allowed ? 'Allowed' : 'Off'}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{limitText(p, schoolCap)}</td>
                      <td className="px-3 py-2.5">
                        <UsageBar used={p.used} limit={isCurrentMonth ? p.limit : null} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-muted">{n(p.sessions)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{lastUsed(p.lastUsedAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Details for ${p.name}`}
                          onClick={() => setEditing([p])}
                        >
                          <Pencil />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[12px] text-ink-faint">
        Credits are shared by the whole school and reset on the 1st of each month. Only a Super Admin manages this
        page; Super Admins always have full access, and nobody can change their own.
      </p>

      {editing && data && (
        <EditDialog
          people={editing}
          month={month}
          schoolCap={schoolCap}
          mode={data.settings.mode}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setSelected(new Set());
            void load();
          }}
        />
      )}
    </div>
  );
}
