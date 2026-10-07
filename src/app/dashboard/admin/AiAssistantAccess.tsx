'use client';

/**
 * Admin Panel → AI Assistant: who in the school may use the assistant, how
 * many of the school's monthly credits each person may spend, and who used
 * how much. Everything here is also enforced by sms-backend; the page only
 * shows and edits it.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
import { Pagination } from '@/components/ui/FilterBar';
import { Note, Panel } from '@/components/ui/Panel';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { INTL_LOCALE } from '@/i18n/config';
import { useRoleLabeler } from './RoleManagerDialog';

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
  summary: {
    staff: number;
    withAccess: number;
    withLimit: number;
    usedByStaff: number;
    /** Deactivated or removed people; with usedByStaff it is the school's total. */
    usedByOthers: number;
  };
  total: number;
  page: number;
  limit: number;
  users: Person[];
}

const PAGE_SIZE = 50;

interface Usage {
  byDay: { day: string; credits: number; events: number }[];
  byTool: { kind: string; name: string; credits: number; calls: number }[];
}

function thisMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

/** Numbers, months and times in the reader's language (Latin digits throughout). */
function useFormat() {
  const intl = INTL_LOCALE[useLocale()];
  return {
    n: (v: number) => v.toLocaleString(intl),
    monthLabel: (m: string) => {
      const [y, mo] = m.split('-').map(Number);
      return new Date(y, mo - 1, 1).toLocaleDateString(intl, { month: 'long', year: 'numeric' });
    },
    lastUsed: (at: string | null) => {
      if (!at) return '—';
      return new Date(at).toLocaleString(intl, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    },
  };
}

/** Tool names as sms-mcp sends them ("attendance_register") → words. */
function toolLabel(kind: string, name: string, model: { llm: string; stt: string; tts: string }) {
  if (kind === 'LLM') return model.llm;
  if (kind === 'STT') return model.stt;
  if (kind === 'TTS') return model.tts;
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function readMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  const m = Array.isArray(body.message) ? body.message.join('; ') : body.message;
  return m || fallback;
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const t = useTranslations('admin.assistant');
  const { n } = useFormat();
  if (limit === null || limit <= 0) {
    return <span className="font-mono tabular-nums text-ink">{n(used)}</span>;
  }
  const share = Math.min(1, used / limit);
  return (
    <div className="min-w-28">
      <span className="font-mono tabular-nums text-ink">
        {n(used)} <span className="text-ink-faint">{t('usageOf', { limit: n(limit) })}</span>
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
  const t = useTranslations('admin.assistant');
  const tc = useTranslations('common');
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
      if (!res.ok) throw new Error(await readMessage(res, t('couldNotSave')));
      toast.success(t('settingsSaved'));
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
            {t('whoCanUse')}
          </p>
          <div className="space-y-2">
            <Choice
              checked={mode === 'ALL_STAFF'}
              onChange={() => setMode('ALL_STAFF')}
              disabled={readOnly}
              title={t('allStaff')}
              hint={t('allStaffHint')}
            />
            <Choice
              checked={mode === 'SELECTED'}
              onChange={() => setMode('SELECTED')}
              disabled={readOnly}
              title={t('onlyChosen')}
              hint={t('onlyChosenHint')}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            {t('monthlyLimitPerPerson')}
          </p>
          <div className="space-y-2">
            <Choice
              checked={!capOn}
              onChange={() => setCapOn(false)}
              disabled={readOnly}
              title={t('noLimit')}
              hint={t('noLimitHint')}
            />
            <Choice
              checked={capOn}
              onChange={() => setCapOn(true)}
              disabled={readOnly}
              title={t('limitEach')}
              hint={t('limitEachHint')}
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
                  <span className="text-[12.5px] text-ink-muted">{t('creditsAMonth')}</span>
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
          {saving ? tc('action.saving') : t('saveSettings')}
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
  const t = useTranslations('admin.assistant');
  const tc = useTranslations('common');
  const roleLabel = useRoleLabeler();
  const { n, monthLabel } = useFormat();
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
      if (!res.ok) throw new Error(await readMessage(res, t('couldNotSave')));
      const r = (await res.json()) as { updated: number[]; skipped: { name: string; reason: string }[] };
      toast.success(r.updated.length === 1 ? t('saved') : t('savedFor', { count: r.updated.length }));
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
    mode === 'ALL_STAFF' ? t('followAllowed') : t('followNotAllowed');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{one ? one.name : t('peopleCount', { count: people.length })}</DialogTitle>
        <DialogDescription>
          {one
            ? one.designation
              ? t('personSummaryWithDesignation', { role: roleLabel(one.role), designation: one.designation, used: n(one.used), month: monthLabel(month) })
              : t('personSummary', { role: roleLabel(one.role), used: n(one.used), month: monthLabel(month) })
            : t('bulkDescription')}
        </DialogDescription>

        <div className="mt-2 space-y-5">
          {one && (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">{t('access')}</p>
            {!one.canEdit ? (
              <Note pigment="neutral">
                {one.tier === 'SUPER_ADMIN'
                  ? t('superAdminsAlwaysAccess')
                  : t('cannotChangeOwnAccess')}
              </Note>
            ) : (
              <div className="space-y-2">
                <Choice checked={access === 'DEFAULT'} onChange={() => setAccess('DEFAULT')} title={followText} />
                <Choice checked={access === 'ALLOWED'} onChange={() => setAccess('ALLOWED')} title={t('allowed')} />
                <Choice
                  checked={access === 'BLOCKED'}
                  onChange={() => setAccess('BLOCKED')}
                  title={t('notAllowed')}
                  hint={t('notAllowedHint')}
                />
              </div>
            )}
          </div>
          )}

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">{t('monthlyLimit')}</p>
            {one && !one.canEdit ? (
              <Note pigment="neutral">
                {one.tier === 'SUPER_ADMIN'
                  ? t('superAdminsNoLimit')
                  : t('cannotChangeOwnLimit')}
              </Note>
            ) : (
              <div className="space-y-2">
                <Choice
                  checked={limitMode === 'DEFAULT'}
                  onChange={() => setLimitMode('DEFAULT')}
                  title={schoolCap === null ? t('schoolSettingNoLimit') : t('schoolSettingCap', { credits: n(schoolCap) })}
                />
                <Choice checked={limitMode === 'NONE'} onChange={() => setLimitMode('NONE')} title={t('noLimit')} />
                <Choice
                  checked={limitMode === 'CUSTOM'}
                  onChange={() => setLimitMode('CUSTOM')}
                  title={t('ownLimit')}
                  hint={t('ownLimitHint')}
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
                      <span className="text-[12.5px] text-ink-muted">{t('creditsAMonth')}</span>
                    </span>
                  )}
                </Choice>
              </div>
            )}
          </div>

          {one && usage && (usage.byTool.length > 0 || usage.byDay.length > 0) && (
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                {t('whereCreditsWent', { month: monthLabel(month) })}
              </p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {usage.byTool.slice(0, 8).map((tool) => (
                  <li key={`${tool.kind}:${tool.name}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate text-ink">
                      {toolLabel(tool.kind, tool.name, { llm: t('tool.llm'), stt: t('tool.stt'), tts: t('tool.tts') })}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-muted">
                      {n(tool.credits)} <span className="text-ink-faint">· {n(tool.calls)}×</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {t('usedOnDays', { count: usage.byDay.length, month: monthLabel(month) })}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tc('action.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || invalid || (one !== null && !one.canEdit)}
          >
            {saving ? tc('action.saving') : tc('action.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────

export function AiAssistantAccess() {
  const t = useTranslations('admin.assistant');
  const tc = useTranslations('common');
  const roleLabel = useRoleLabeler();
  const { n, monthLabel, lastUsed } = useFormat();
  const readOnly = useReadOnlySession();
  const [month, setMonth] = useState(thisMonth);
  const [q, setQ] = useState('');
  const search = useDeferredValue(q.trim());
  const [filter, setFilter] = useState<'' | 'ALLOWED' | 'NOT_ALLOWED'>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Person[] | null>(null);

  // Searched and paged by the server, so a school of any size lists everyone.
  const params = new URLSearchParams({ month, page: String(page), limit: String(PAGE_SIZE) });
  if (filter) params.set('access', filter);
  if (search) params.set('q', search);
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
      t('loadFailed'))
    : null;
  const load = useCallback(() => void mutate(), [mutate]);

  const people = useMemo(() => data?.users ?? [], [data]);
  /** A new search, filter or month starts again from the first page. */
  const restart = () => {
    setPage(1);
    setSelected(new Set());
  };

  const selectable = people.filter((p) => p.canEdit);
  const chosen = people.filter((p) => selected.has(p.id));
  const allChosen = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  const setAccessFor = async (p: Person, allowed: boolean) => {
    const res = await authFetch(`${API_BASE_URL}/agent/access-control/users`, {
      method: 'PATCH',
      body: JSON.stringify({ userIds: [p.id], access: allowed ? 'ALLOWED' : 'BLOCKED' }),
    });
    if (!res.ok) return toast.error(await readMessage(res, t('changeAccessFailed')));
    toast.success(allowed ? t('accessAllowed', { name: p.name }) : t('accessTurnedOff', { name: p.name }));
    void load();
  };

  const bulkAccess = async (access: AccessChoice) => {
    const res = await authFetch(`${API_BASE_URL}/agent/access-control/users`, {
      method: 'PATCH',
      body: JSON.stringify({ userIds: chosen.map((p) => p.id), access }),
    });
    if (!res.ok) return toast.error(await readMessage(res, t('changeAccessFailed')));
    const r = (await res.json()) as { updated: number[]; skipped: unknown[] };
    toast.success(
      r.skipped.length
        ? t('bulkUpdatedSkipped', { updated: r.updated.length, skipped: r.skipped.length })
        : t('bulkUpdated', { updated: r.updated.length }),
    );
    setSelected(new Set());
    void load();
  };

  const isCurrentMonth = month === thisMonth();
  const schoolCap = data?.settings.defaultUserCredits ?? null;

  const limitText = (p: Person) => {
    if (p.tier === 'SUPER_ADMIN') return t('noLimit');
    if (p.limitMode === 'CUSTOM') return t('perMonth', { credits: n(p.monthlyCredits ?? 0) });
    if (p.limitMode === 'NONE') return t('noLimit');
    return schoolCap === null ? t('noLimit') : t('perMonthSchool', { credits: n(schoolCap) });
  };

  if (error && !data) {
    return (
      <Panel>
        <EmptyState icon={<Sparkles />} title={t('couldNotLoad')} description={error} />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {data && (
        <StatGrid columns={4}>
          <StatTile
            label={t('creditsLeft')}
            value={n(data.quota.remaining)}
            hint={t('creditsLeftHint', { limit: n(data.quota.limit), month: monthLabel(data.month) })}
            pigment={data.quota.remaining <= 0 ? 'danger' : data.quota.remaining < data.quota.limit * 0.1 ? 'attn' : 'ai'}
          />
          <StatTile
            label={t('usedByStaff')}
            value={n(data.summary.usedByStaff)}
            hint={
              data.summary.usedByOthers > 0
                ? t('usedByStaffHintOthers', { month: monthLabel(data.month), others: n(data.summary.usedByOthers) })
                : t('usedByStaffHint', { month: monthLabel(data.month) })
            }
            pigment="info"
          />
          <StatTile
            label={t('staffWithAccess')}
            value={`${n(data.summary.withAccess)} / ${n(data.summary.staff)}`}
            hint={data.settings.mode === 'ALL_STAFF' ? t('allStaffMode') : t('onlyChosenMode')}
            pigment="success"
          />
          <StatTile
            label={t('withLimit')}
            value={n(data.summary.withLimit)}
            hint={schoolCap === null ? t('noSchoolCap') : t('schoolCap', { credits: n(schoolCap) })}
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
              onChange={(e) => {
                setQ(e.target.value);
                restart();
              }}
              placeholder={t('searchPlaceholder')}
              className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-[13.5px] focus:border-brand focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as typeof filter);
                restart();
              }}
              className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13.5px] sm:flex-none"
              aria-label={t('filterAria')}
            >
              <option value="">{t('everyone')}</option>
              <option value="ALLOWED">{t('hasAccess')}</option>
              <option value="NOT_ALLOWED">{t('noAccess')}</option>
            </select>
            <input
              type="month"
              value={month}
              max={thisMonth()}
              onChange={(e) => {
                if (!e.target.value) return;
                setMonth(e.target.value);
                restart();
              }}
              className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-2 text-[13.5px] sm:flex-none"
              aria-label={t('monthAria')}
            />
          </div>
        </div>

        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-tint px-4 py-2.5">
            <span className="mr-1 text-[13px] font-semibold text-ink">{t('selectedCount', { count: chosen.length })}</span>
            <Button size="xs" variant="outline" onClick={() => bulkAccess('ALLOWED')} disabled={readOnly}>
              {t('allow')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => bulkAccess('BLOCKED')} disabled={readOnly}>
              {t('turnOff')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(chosen)} disabled={readOnly}>
              {t('setLimit')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>
              {tc('action.clear')}
            </Button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16">
            <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : people.length === 0 ? (
          <EmptyState compact icon={<Users />} title={t('noMatch')} description={t('noMatchHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-[13.5px]">
              <thead className="bg-surface-secondary font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={tc('action.selectAll')}
                      checked={allChosen}
                      onChange={() =>
                        setSelected(allChosen ? new Set() : new Set(selectable.map((p) => p.id)))
                      }
                    />
                  </th>
                  <th className="px-3 py-2.5">{tc('field.name')}</th>
                  <th className="px-3 py-2.5">{t('access')}</th>
                  {/* The setting as it is now; the bar shows the month's own limit. */}
                  <th className="px-3 py-2.5">{isCurrentMonth ? t('monthlyLimit') : t('limitNow')}</th>
                  <th className="px-3 py-2.5">{t('creditsUsed')}</th>
                  <th className="px-3 py-2.5 text-right">{t('chats')}</th>
                  <th className="px-3 py-2.5">{t('lastUsed')}</th>
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
                          aria-label={t('selectPerson', { name: p.name })}
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
                            aria-label={t('switchAria', { name: p.name })}
                            disabled={readOnly}
                            title={readOnly ? READ_ONLY_TITLE : p.access === 'DEFAULT' ? t('followsSchool') : undefined}
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
                            label={p.tier === 'SUPER_ADMIN' ? t('always') : p.allowed ? t('allowed') : t('off')}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{limitText(p)}</td>
                      <td className="px-3 py-2.5">
                        {/* A past month shows the limit it ran under. */}
                        <UsageBar used={p.used} limit={p.limit} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-muted">{n(p.sessions)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{lastUsed(p.lastUsedAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t('detailsFor', { name: p.name })}
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
        {data && data.total > PAGE_SIZE && (
          <Pagination
            className="border-t border-line px-4 py-3"
            page={page}
            pageCount={Math.ceil(data.total / PAGE_SIZE)}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={(next) => {
              setPage(next);
              setSelected(new Set());
            }}
          />
        )}
      </Panel>

      <p className="text-[12px] text-ink-faint">
        {t('footer')}
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
