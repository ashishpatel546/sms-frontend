'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { DoorOpen, Loader2, Minus, Plus, Settings2 } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/skeleton';
import { useRbac } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import {
  EVENT_PASS_MAX_MEMBERS,
  EVENT_PASS_RE_ENTRY,
  EVENT_PASS_TIER_COLORS,
  EVENT_PASS_TIERS,
  errorMessage,
  fetchEventPassSettings,
  fetchEventPassZones,
  saveEventPassSettings,
  saveEventPassZones,
  type EventPassReEntry,
  type EventPassSettings,
  type EventPassTier,
  type EventPassZones,
} from '@/lib/event-passes-api';

export const EVENT_PASS_SETTINGS_KEY = 'event-pass-settings';

/** The school's pass rules; shared by the settings dialog, the issue form and the gate. */
export function useEventPassSettings(enabled = true) {
  return useSWR<EventPassSettings>(enabled ? EVENT_PASS_SETTINGS_KEY : null, fetchEventPassSettings);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHOOL-WIDE PASS RULES

   Who may come back in after checking out, and how many people one pass may
   admit. Anyone who manages events can read them; only an admin can change
   them, because they decide how strict every gate is.
   ═══════════════════════════════════════════════════════════════════════════ */

export function EventPassSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('eventPasses.settings');
  const { data, error } = useEventPassSettings(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold">
          <Settings2 className="size-4" aria-hidden />
          {t('title')}
        </DialogTitle>
        <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{t('subtitle')}</DialogDescription>
        {error ? (
          <p className="text-accent-danger text-[13px]">{errorMessage(error, t('loadFailed'))}</p>
        ) : !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          // Mounted once the saved values are in, so the form starts from them.
          <SettingsForm initial={data} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ initial, onClose }: { initial: EventPassSettings; onClose: () => void }) {
  const t = useTranslations('eventPasses.settings');
  const tc = useTranslations('common');
  const { isAdmin } = useRbac();
  const { mutate } = useEventPassSettings(false);
  const [reEntry, setReEntry] = React.useState<EventPassReEntry>(initial.reEntry);
  const [max, setMax] = React.useState(initial.maxPeoplePerPass);
  const [busy, setBusy] = React.useState(false);
  const clamp = (n: number) => Math.max(1, Math.min(EVENT_PASS_MAX_MEMBERS, n));

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveEventPassSettings({ reEntry, maxPeoplePerPass: max });
      await mutate(saved, { revalidate: false });
      toast.success(t('saved'));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t('saveFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <fieldset disabled={!isAdmin} className="space-y-5">
        <div>
          <p className="text-ink mb-2 text-[13px] font-semibold">{t('reEntry')}</p>
          <div role="radiogroup" aria-label={t('reEntry')} className="space-y-2">
            {EVENT_PASS_RE_ENTRY.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={reEntry === value}
                onClick={() => setReEntry(value)}
                className={cn(
                  'block w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                  reEntry === value ? 'border-brand bg-brand-tint' : 'border-line hover:bg-surface-sunk',
                )}
              >
                <span className="text-ink flex items-center gap-2 text-[13.5px] font-medium">
                  <span
                    aria-hidden
                    className={cn('size-3.5 shrink-0 rounded-full border-2', reEntry === value ? 'border-brand bg-brand' : 'border-line-strong')}
                  />
                  {t(`option.${value}.label`)}
                  {value === 'NAMED_ONLY' && <span className="text-ink-muted text-[11px] font-normal">· {t('recommended')}</span>}
                </span>
                <span className="text-ink-muted mt-0.5 block pl-[22px] text-[12px]">{t(`option.${value}.hint`)}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label={t('maxPeople')} hint={t('maxPeopleHint')}>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon-sm" onClick={() => setMax(clamp(max - 1))} aria-label={t('fewer')}>
              <Minus />
            </Button>
            <Input
              inputMode="numeric"
              className="w-16 text-center"
              value={String(max)}
              onChange={(e) => setMax(clamp(Number(e.target.value.replace(/\D/g, '')) || 1))}
              aria-label={t('maxPeople')}
            />
            <Button type="button" variant="outline" size="icon-sm" onClick={() => setMax(clamp(max + 1))} aria-label={t('more')}>
              <Plus />
            </Button>
          </div>
        </Field>
      </fieldset>

      {!isAdmin && <p className="text-ink-muted text-[12px]">{t('adminOnly')}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {isAdmin ? tc('action.cancel') : tc('action.close')}
        </Button>
        {isAdmin && (
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {tc('action.save')}
          </Button>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GATES AND ZONES, PER EVENT

   Which gate or area each pass type uses — printed on the pass, shown on the
   parent's phone and, largest of all, to the guard who scans it.
   ═══════════════════════════════════════════════════════════════════════════ */

export function EventPassZonesDialog({
  activityId,
  open,
  onOpenChange,
  onSaved,
}: {
  activityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations('eventPasses.zones');
  const { data, error, mutate } = useSWR(open ? ['event-pass-zones', activityId] : null, () => fetchEventPassZones(activityId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold">
          <DoorOpen className="size-4" aria-hidden />
          {t('title')}
        </DialogTitle>
        <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{t('subtitle')}</DialogDescription>
        {error ? (
          <p className="text-accent-danger text-[13px]">{errorMessage(error, t('loadFailed'))}</p>
        ) : !data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ZonesForm
            activityId={activityId}
            initial={data}
            onClose={() => onOpenChange(false)}
            onSaved={(z) => {
              void mutate(z, { revalidate: false });
              onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ZonesForm({
  activityId,
  initial,
  onClose,
  onSaved,
}: {
  activityId: string;
  initial: EventPassZones;
  onClose: () => void;
  onSaved: (zones: EventPassZones) => void;
}) {
  const t = useTranslations('eventPasses');
  const tc = useTranslations('common');
  const [zones, setZones] = React.useState<Record<EventPassTier, string>>(
    () => Object.fromEntries(EVENT_PASS_TIERS.map((tier) => [tier, initial[tier] ?? ''])) as Record<EventPassTier, string>,
  );
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveEventPassZones(activityId, zones);
      toast.success(t('zones.saved'));
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t('zones.saveFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="space-y-2.5">
        {EVENT_PASS_TIERS.map((tier) => {
          const tone = EVENT_PASS_TIER_COLORS[tier];
          return (
            <label key={tier} className="flex items-center gap-3">
              <span
                className="w-20 shrink-0 rounded-md px-2 py-1.5 text-center font-mono text-[11px] font-bold tracking-wider uppercase"
                style={{ backgroundColor: tone.band, color: tone.ink }}
              >
                {t(`tier.${tier}`)}
              </span>
              <Input
                value={zones[tier]}
                maxLength={120}
                placeholder={t('zones.placeholder')}
                aria-label={t('zones.forTier', { tier: t(`tier.${tier}`) })}
                onChange={(e) => setZones((z) => ({ ...z, [tier]: e.target.value }))}
                className="min-w-0 flex-1"
              />
            </label>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {tc('action.cancel')}
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {tc('action.save')}
        </Button>
      </div>
    </>
  );
}
