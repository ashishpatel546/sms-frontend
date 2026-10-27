'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Car, Loader2, Minus, Plus, UserRound } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { INTL_LOCALE } from '@/i18n/config';
import { useEventPassSettings } from './EventPassSettingsDialogs';
import { formatMobileInput, isValidMobile } from '@/lib/mobile';
import { cn } from '@/lib/utils';
import {
  EVENT_PASS_MAX_MEMBERS,
  EVENT_PASS_RELATIONS,
  EVENT_PASS_TIER_COLORS,
  EVENT_PASS_TIERS,
  EVENT_PASS_VEHICLE_TYPES,
  createEventPass,
  errorMessage,
  eventDays,
  lookupEventPassMobile,
  passSerial,
  passShortDate,
  updateEventPass,
  type EventPass,
  type EventPassHolderRelation,
  type EventPassInput,
  type EventPassLookup,
  type EventPassTier,
  type EventPassVehicleType,
} from '@/lib/event-passes-api';

/* ═══════════════════════════════════════════════════════════════════════════
   ISSUE / EDIT A PASS

   Mobile first, because it does the most work: one number finds the children
   it belongs to and the parent names on file, so the issuer usually types ten
   digits and presses Issue. A mobile does not say whether it is the father's
   or the mother's, so every name on file is offered as a one-tap choice, and
   the father's is filled in only while the name field is still empty or still
   holds an earlier suggestion — never over something the issuer typed.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: { id: string; startDate: string; endDate: string | null };
  /** Absent → issue a new pass. */
  pass?: EventPass | null;
  onSaved: (pass: EventPass) => void;
}

export function EventPassFormDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted per opening, so every field starts from the pass (or blank) without a reset effect. */}
        {open && <PassForm key={rest.pass?.id ?? 'new'} onOpenChange={onOpenChange} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function PassForm({ onOpenChange, activity, pass, onSaved }: Omit<Props, 'open'>) {
  const t = useTranslations('eventPasses');
  const tc = useTranslations('common');
  const intlLocale = INTL_LOCALE[useLocale() as keyof typeof INTL_LOCALE];
  const days = React.useMemo(() => eventDays(activity.startDate, activity.endDate), [activity.startDate, activity.endDate]);

  const [mobile, setMobile] = React.useState(pass?.mobile ?? '');
  const [holderName, setHolderName] = React.useState(pass?.holderName ?? '');
  const [holderRelation, setHolderRelation] = React.useState<EventPassHolderRelation | ''>(pass?.holderRelation ?? '');
  const [tier, setTier] = React.useState<EventPassTier>(pass?.tier ?? 'GENERAL');
  const [members, setMembers] = React.useState(pass?.membersAllowed ?? 1);
  const { data: settings } = useEventPassSettings();
  // A pass issued before the limit was lowered may keep its count, never grow past it.
  const maxMembers = Math.max(settings?.maxPeoplePerPass ?? EVENT_PASS_MAX_MEMBERS, pass?.membersAllowed ?? 1);
  const [showNames, setShowNames] = React.useState((pass?.memberNames.length ?? 0) > 0);
  const [memberNames, setMemberNames] = React.useState<string[]>(pass?.memberNames ?? []);
  const [vehicleType, setVehicleType] = React.useState<EventPassVehicleType | ''>(pass?.vehicleType ?? '');
  const [vehicleNumber, setVehicleNumber] = React.useState(pass?.vehicleNumber ?? '');
  const [allDays, setAllDays] = React.useState(pass ? pass.allDays : true);
  const [validDates, setValidDates] = React.useState<string[]>(pass?.validDates ?? []);
  const [remarks, setRemarks] = React.useState(pass?.remarks ?? '');
  const [studentIds, setStudentIds] = React.useState<number[]>(pass?.students.map((s) => s.id) ?? []);
  const [busy, setBusy] = React.useState(false);

  // The answer for one specific number. Anything shown is derived from it, so
  // a lookup for a number since edited away is simply not shown.
  const [answer, setAnswer] = React.useState<{ mobile: string; data: EventPassLookup | null } | null>(null);
  const lookup = answer?.mobile === mobile ? answer.data : null;
  const lookingUp = isValidMobile(mobile) && answer?.mobile !== mobile;

  // The last name WE filled in. If the field still holds it, a new lookup may
  // replace it; anything else was typed by a person and stays.
  const autoName = React.useRef<string | null>(null);
  // Read by the lookup callback, which must not re-run on every keystroke.
  const holderNameRef = React.useRef(holderName);
  const changeHolderName = (value: string) => {
    holderNameRef.current = value;
    setHolderName(value);
  };

  // Look the number up as soon as it is a complete, valid mobile.
  React.useEffect(() => {
    if (!isValidMobile(mobile)) return;
    let cancelled = false;
    lookupEventPassMobile(activity.id, mobile)
      .then((res) => {
        if (cancelled) return;
        setAnswer({ mobile, data: res });
        // An existing pass keeps the students it was saved with, unless its number changed.
        if (!pass || pass.mobile !== mobile) setStudentIds(res.students.map((s) => s.id));
        const first = res.suggestions[0];
        const current = holderNameRef.current;
        if (first && (current.trim() === '' || current === autoName.current)) {
          autoName.current = first.name;
          changeHolderName(first.name);
          setHolderRelation(first.relation);
        }
      })
      .catch(() => {
        if (!cancelled) setAnswer({ mobile, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mobile, activity.id, pass]);

  const otherPasses = (lookup?.existingPasses ?? []).filter((p) => p.id !== pass?.id && p.status === 'ACTIVE');
  const mobileInvalid = mobile.length > 0 && !isValidMobile(mobile);
  const namesGiven = memberNames.filter((n) => n.trim()).length;

  const setMemberCount = (n: number) => {
    const next = Math.max(1, Math.min(maxMembers, n));
    setMembers(next);
    setMemberNames((names) => names.slice(0, next));
  };

  const toggleDay = (day: string) =>
    setValidDates((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));

  const submit = async () => {
    if (mobileInvalid) {
      toast.error(t('form.mobileInvalid'));
      return;
    }
    if (!allDays && days.length > 1 && validDates.length === 0) {
      toast.error(t('form.pickDay'));
      return;
    }
    if (vehicleType && !vehicleNumber.trim()) {
      toast.error(t('form.vehicleNumberRequired'));
      return;
    }
    const input: EventPassInput = {
      tier,
      holderName: holderName.trim(),
      holderRelation: holderRelation || null,
      mobile,
      studentIds,
      membersAllowed: members,
      memberNames: showNames ? memberNames.map((n) => n.trim()).filter(Boolean) : [],
      vehicleType: vehicleType || null,
      vehicleNumber: vehicleType ? vehicleNumber.trim() : null,
      allDays: days.length <= 1 ? true : allDays,
      validDates: days.length <= 1 || allDays ? [] : validDates,
      remarks: remarks.trim(),
    };
    setBusy(true);
    try {
      const saved = pass ? await updateEventPass(activity.id, pass.id, input) : await createEventPass(activity.id, input);
      toast.success(pass ? t('form.updated') : t('form.issued', { serial: passSerial(saved.serial) }));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t('form.saveFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
        <DialogTitle className="text-[16px] font-semibold">
          {pass ? t('form.editTitle', { serial: passSerial(pass.serial) }) : t('form.issueTitle')}
        </DialogTitle>
        <DialogDescription className="text-ink-muted -mt-2 text-[12.5px]">{t('form.subtitle')}</DialogDescription>

        {/* ── Who ─────────────────────────────────────────────────────── */}
        <FieldGrid>
          <Field
            label={t('form.mobile')}
            htmlFor="ep-mobile"
            hint={lookingUp ? t('form.lookingUp') : t('form.mobileHint')}
            error={mobileInvalid ? t('form.mobileInvalid') : undefined}
          >
            <Input
              id="ep-mobile"
              inputMode="numeric"
              autoComplete="off"
              value={mobile}
              onChange={(e) => setMobile(formatMobileInput(e.target.value))}
              placeholder="98765 43210"
            />
          </Field>
          <Field label={t('form.holderName')} htmlFor="ep-name" hint={t('form.optional')}>
            <div className="flex gap-2">
              <Input
                id="ep-name"
                value={holderName}
                maxLength={150}
                onChange={(e) => changeHolderName(e.target.value)}
                className="min-w-0 flex-1"
              />
              <Select
                aria-label={t('form.relation')}
                value={holderRelation}
                onChange={(e) => setHolderRelation(e.target.value as EventPassHolderRelation | '')}
                className="w-32 shrink-0"
              >
                <option value="">{t('form.relationNone')}</option>
                {EVENT_PASS_RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`relation.${r}`)}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        </FieldGrid>

        {lookup && (
          <div className="border-line bg-surface-sunk space-y-2.5 rounded-xl border p-3">
            {lookup.students.length === 0 ? (
              <p className="text-ink-muted text-[12.5px]">{t('form.notLinked')}</p>
            ) : (
              <>
                <p className="text-ink-muted text-[11px] font-semibold tracking-widest uppercase">{t('form.linkedTo')}</p>
                <div className="flex flex-wrap gap-x-4">
                  {lookup.students.map((s) => (
                    <Checkbox
                      key={s.id}
                      checked={studentIds.includes(s.id)}
                      onChange={(e) =>
                        setStudentIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id)))
                      }
                      label={s.name}
                      description={[s.className, s.section].filter(Boolean).join('-') || undefined}
                    />
                  ))}
                </div>
              </>
            )}
            {lookup.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-ink-muted text-[12px]">{t('form.useName')}</span>
                {lookup.suggestions.map((sug) => (
                  <button
                    key={`${sug.relation}-${sug.name}`}
                    type="button"
                    onClick={() => {
                      autoName.current = sug.name;
                      changeHolderName(sug.name);
                      setHolderRelation(sug.relation);
                    }}
                    className={cn(
                      'border-line inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                      holderName === sug.name ? 'border-brand bg-brand-tint text-ink' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    <UserRound className="size-3" aria-hidden />
                    {sug.name} · {t(`relation.${sug.relation}`)}
                  </button>
                ))}
              </div>
            )}
            {otherPasses.length > 0 && (
              <p className="text-accent-warn-deep flex items-start gap-1.5 text-[12.5px]">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t('form.alreadyHas', {
                  count: otherPasses.length,
                  serials: otherPasses.map((p) => passSerial(p.serial)).join(', '),
                })}
              </p>
            )}
          </div>
        )}

        {/* ── Tier ────────────────────────────────────────────────────── */}
        <Field label={t('form.tier')}>
          <div role="radiogroup" aria-label={t('form.tier')} className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {EVENT_PASS_TIERS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={tier === value}
                onClick={() => setTier(value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-medium transition-colors',
                  tier === value ? 'border-brand bg-brand-tint text-ink' : 'border-line text-ink-muted hover:text-ink',
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: EVENT_PASS_TIER_COLORS[value].band }} aria-hidden />
                {t(`tier.${value}`)}
              </button>
            ))}
          </div>
        </Field>

        {/* ── People ──────────────────────────────────────────────────── */}
        <FieldGrid>
          <Field label={t('form.members')} hint={settings ? t('form.membersHintMax', { max: maxMembers }) : t('form.membersHint')}>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setMemberCount(members - 1)} aria-label={t('form.fewer')}>
                <Minus />
              </Button>
              <Input
                inputMode="numeric"
                className="w-16 text-center"
                value={String(members)}
                onChange={(e) => setMemberCount(Number(e.target.value.replace(/\D/g, '')) || 1)}
                aria-label={t('form.members')}
              />
              <Button type="button" variant="outline" size="icon-sm" onClick={() => setMemberCount(members + 1)} disabled={members >= maxMembers} aria-label={t('form.more')}>
                <Plus />
              </Button>
            </div>
          </Field>
          <Field label={t('form.vehicle')} hint={t('form.optional')}>
            <div className="flex gap-2">
              <Select
                aria-label={t('form.vehicleType')}
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as EventPassVehicleType | '')}
                className="w-36 shrink-0"
              >
                <option value="">{t('form.noVehicle')}</option>
                {EVENT_PASS_VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`vehicle.${v}`)}
                  </option>
                ))}
              </Select>
              {vehicleType && (
                <Input
                  aria-label={t('form.vehicleNumber')}
                  value={vehicleNumber}
                  maxLength={20}
                  placeholder="DL 3C AB 1234"
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="min-w-0 flex-1 uppercase"
                />
              )}
              {!vehicleType && <Car className="text-ink-faint my-auto size-4" aria-hidden />}
            </div>
          </Field>
        </FieldGrid>

        <div>
          <Checkbox
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            label={t('form.addNames')}
            description={settings?.reEntry === 'NAMED_ONLY' ? t('form.addNamesReEntry') : t('form.addNamesHint')}
          />
          {showNames && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: members }, (_, i) => (
                <Input
                  key={i}
                  value={memberNames[i] ?? ''}
                  maxLength={100}
                  placeholder={t('form.personN', { n: i + 1 })}
                  onChange={(e) =>
                    setMemberNames((names) => {
                      const next = [...names];
                      while (next.length < i) next.push('');
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
              <p className="text-ink-muted text-[12px] sm:col-span-2">{t('form.namesCount', { given: namesGiven, total: members })}</p>
            </div>
          )}
        </div>

        {/* ── Days ────────────────────────────────────────────────────── */}
        {days.length > 1 && (
          <div>
            <Checkbox
              checked={allDays}
              onChange={(e) => setAllDays(e.target.checked)}
              label={t('form.allDays')}
              description={t('form.allDaysHint', { count: days.length })}
            />
            {!allDays && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('form.pickDays')}>
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={validDates.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
                      validDates.includes(day) ? 'border-brand bg-brand-tint text-ink font-medium' : 'border-line text-ink-muted hover:text-ink',
                    )}
                  >
                    {passShortDate(day, intlLocale)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label={t('form.remarks')} htmlFor="ep-remarks" hint={t('form.remarksHint')}>
          <Textarea id="ep-remarks" rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {tc('action.cancel')}
          </Button>
          <Button onClick={submit} disabled={busy || mobileInvalid}>
            {busy && <Loader2 className="animate-spin" />}
            {pass ? tc('action.save') : t('form.issue')}
          </Button>
        </div>
    </>
  );
}
