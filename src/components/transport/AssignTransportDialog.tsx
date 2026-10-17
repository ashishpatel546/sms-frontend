'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';

import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { useRbac } from '@/lib/rbac';
import {
  assignTransport,
  changeTransport,
  errorMessage,
  exemptionAmount,
  fetchRoutes,
  fetchSettings,
  todayIst,
  TransportApiError,
  type Assignment,
  type ExemptionType,
  type JoinBilling,
  type Route,
  type TransportPlanInput,
} from '@/lib/transport-api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldGrid, Fieldset, Input, Select, Textarea } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/FilterBar';
import { Note } from '@/components/ui/Panel';
import { formatINR } from '@/components/ui/Money';

interface StudentHit {
  id: number;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  class?: { name: string } | null;
  section?: { name: string } | null;
}

const studentLabel = (s: StudentHit) =>
  [
    `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
    s.class?.name ? `${s.class.name}${s.section?.name ? `-${s.section.name}` : ''}` : null,
    s.admissionNumber,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Assign transport to a student, or change an existing assignment from a
 * date. One form for both: a change is the same plan (route, stops, fee,
 * exemption) with an effective date instead of a start date.
 */
export function AssignTransportDialog({
  existing,
  onClose,
  onSaved,
}: {
  /** Present when changing; absent when assigning. */
  existing?: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.assignForm');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const rbac = useRbac();
  const isChange = Boolean(existing);

  const { data: routes } = useSWR('/transport/routes', fetchRoutes);
  const { data: settings } = useSWR('/transport/settings', fetchSettings);
  const activeRoutes = React.useMemo(() => (routes ?? []).filter((r) => r.isActive), [routes]);

  const [student, setStudent] = React.useState<StudentHit | null>(null);
  const [date, setDate] = React.useState(todayIst());
  const [pickupRouteId, setPickupRouteId] = React.useState<number | ''>(existing?.pickupRoute.id ?? '');
  const [pickupStopId, setPickupStopId] = React.useState<number | ''>(existing?.pickupStop.id ?? '');
  const [sameEvening, setSameEvening] = React.useState(existing?.sameEveningRoute ?? true);
  const [dropSame, setDropSame] = React.useState(existing?.dropSameAsPickup ?? true);
  const [dropRouteId, setDropRouteId] = React.useState<number | ''>(existing?.dropRoute.id ?? '');
  const [dropStopId, setDropStopId] = React.useState<number | ''>(existing?.dropStop.id ?? '');
  const [feeInput, setFee] = React.useState(existing ? String(existing.monthlyFee) : '');
  const [feeTouched, setFeeTouched] = React.useState(isChange);
  const [joinBilling, setJoinBilling] = React.useState<JoinBilling | null>(null);
  const [exemption, setExemption] = React.useState(Boolean(existing?.exemption && existing.exemption.status !== 'REJECTED'));
  const [exType, setExType] = React.useState<ExemptionType>(existing?.exemption?.type ?? 'PERCENT');
  const [exValue, setExValue] = React.useState(existing?.exemption ? String(existing.exemption.value) : '');
  const [exReason, setExReason] = React.useState(existing?.exemption?.reason ?? '');
  const [remarks, setRemarks] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [confirmReplace, setConfirmReplace] = React.useState(false);

  const effectiveJoin: JoinBilling = joinBilling ?? settings?.defaultJoinBilling ?? 'FULL';
  const pickupRoute = activeRoutes.find((r) => r.id === pickupRouteId);
  const dropRoute = sameEvening ? pickupRoute : activeRoutes.find((r) => r.id === dropRouteId);
  const pickupStop = pickupRoute?.stops.find((s) => s.id === pickupStopId);

  // The stop's default fee shows until the person types their own.
  const fee =
    !feeTouched && pickupStop?.monthlyFee != null ? String(Number(pickupStop.monthlyFee)) : feeInput;

  const feeNumber = Number(fee) || 0;
  const valueNumber = Number(exValue) || 0;
  const off = exemption ? exemptionAmount(feeNumber, exType, valueNumber) : 0;
  const unchangedExemption =
    isChange &&
    existing?.exemption != null &&
    existing.exemption.type === exType &&
    existing.exemption.value === valueNumber;
  // An approver's own exemption applies straight away; anyone else's waits.
  const approverRank: Record<string, (r: ReturnType<typeof useRbac>) => boolean> = {
    SUPER_ADMIN: (r) => r.isSuperAdmin,
    ADMIN: (r) => r.isAdmin,
    SUB_ADMIN: (r) => r.isSubAdmin,
  };
  const canApprove = approverRank[settings?.exemptionApproverRole ?? 'ADMIN']?.(rbac) ?? false;

  const stopsOf = (route: Route | undefined) => (route?.stops ?? []).filter((s) => s.isActive);

  const submit = async (e?: React.FormEvent, replaceManualFee = false) => {
    e?.preventDefault();
    if (saving) return;
    if (!isChange && !student) return;
    if (!pickupRouteId || !pickupStopId) return;
    setSaving(true);
    const plan: TransportPlanInput = {
      pickupRouteId: Number(pickupRouteId),
      pickupStopId: Number(pickupStopId),
      sameEveningRoute: sameEvening,
      dropSameAsPickup: sameEvening && dropSame,
      ...(sameEvening ? {} : { dropRouteId: Number(dropRouteId) }),
      ...(sameEvening && dropSame ? {} : { dropStopId: Number(dropStopId) }),
      monthlyFee: feeNumber,
      exemption,
      ...(exemption
        ? { exemptionType: exType, exemptionValue: valueNumber, exemptionReason: exReason.trim() || undefined }
        : {}),
      remarks: remarks.trim() || undefined,
    };
    try {
      if (existing) {
        await changeTransport(existing.id, { ...plan, effectiveFrom: date });
        toast.success(t('changed'));
      } else {
        await assignTransport({
          ...plan,
          studentId: student!.id,
          startDate: date,
          joinBilling: effectiveJoin,
          replaceManualFee,
        });
        toast.success(t('assigned'));
      }
      onSaved();
    } catch (err) {
      if (err instanceof TransportApiError && err.code === 'TRANSPORT_MANUAL_FEE_EXISTS') {
        setConfirmReplace(true);
      } else {
        toast.error(errorMessage(err, t('failed')));
      }
    } finally {
      setSaving(false);
    }
  };

  const showJoinBilling = !isChange && date.slice(8, 10) !== '01';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {confirmReplace ? (
          <div>
            <DialogHeader>
              <DialogTitle>{t('manualFeeTitle')}</DialogTitle>
            </DialogHeader>
            <p className="mt-3 text-[13.5px] text-ink">{t('manualFeeBody')}</p>
            <DialogFooter className="mt-5">
              <Button type="button" variant="ghost" onClick={() => setConfirmReplace(false)}>
                {tc('action.cancel')}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  setConfirmReplace(false);
                  void submit(undefined, true);
                }}
              >
                {t('replace')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="max-h-[80vh] overflow-x-hidden overflow-y-auto px-0.5">
            <DialogHeader>
              <DialogTitle>
                {existing ? t('titleChange', { name: existing.student?.name ?? '' }) : t('titleAssign')}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-3 space-y-5">
              <FieldGrid>
                {!isChange && (
                  <Field label={t('student')} required wide>
                    <StudentPicker value={student} onChange={setStudent} />
                  </Field>
                )}
                <Field
                  label={isChange ? t('effectiveFrom') : t('startDate')}
                  hint={isChange ? t('effectiveFromHint') : undefined}
                  required
                >
                  <Input
                    type="date"
                    value={date}
                    min={existing?.startDate}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>
                {showJoinBilling && (
                  <Field label={t('joinBilling')} hint={t('joinBillingHint')}>
                    <Select value={effectiveJoin} onChange={(e) => setJoinBilling(e.target.value as JoinBilling)}>
                      <option value="FULL">{tt('billing.FULL')}</option>
                      <option value="PRORATED">{tt('billing.PRORATED')}</option>
                    </Select>
                  </Field>
                )}
              </FieldGrid>

              <Fieldset legend={t('morning')}>
                <FieldGrid>
                  <Field label={t('route')} required>
                    <Select
                      value={pickupRouteId}
                      onChange={(e) => {
                        setPickupRouteId(e.target.value ? Number(e.target.value) : '');
                        setPickupStopId('');
                      }}
                      required
                    >
                      <option value="">{t('selectRoute')}</option>
                      {activeRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeNumber} — {r.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('stop')} required>
                    <Select
                      value={pickupStopId}
                      onChange={(e) => setPickupStopId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!pickupRoute}
                      required
                    >
                      <option value="">{t('selectStop')}</option>
                      {stopsOf(pickupRoute).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sequence}. {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </FieldGrid>
              </Fieldset>

              <Fieldset legend={t('evening')}>
                <div className="space-y-1">
                  <Checkbox
                    label={t('sameEvening')}
                    checked={sameEvening}
                    onChange={(e) => setSameEvening(e.target.checked)}
                  />
                  {sameEvening && (
                    <Checkbox
                      label={t('dropSameAsPickup')}
                      checked={dropSame}
                      onChange={(e) => setDropSame(e.target.checked)}
                    />
                  )}
                </div>
                {!(sameEvening && dropSame) && (
                  <FieldGrid className="mt-3">
                    {!sameEvening && (
                      <Field label={t('route')} required>
                        <Select
                          value={dropRouteId}
                          onChange={(e) => {
                            setDropRouteId(e.target.value ? Number(e.target.value) : '');
                            setDropStopId('');
                          }}
                          required
                        >
                          <option value="">{t('selectRoute')}</option>
                          {activeRoutes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.routeNumber} — {r.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    <Field label={t('stop')} required>
                      <Select
                        value={dropStopId}
                        onChange={(e) => setDropStopId(e.target.value ? Number(e.target.value) : '')}
                        disabled={!dropRoute}
                        required
                      >
                        <option value="">{t('selectStop')}</option>
                        {stopsOf(dropRoute).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.sequence}. {s.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </FieldGrid>
                )}
              </Fieldset>

              <FieldGrid>
                <Field
                  label={t('fee')}
                  required
                  hint={
                    pickupStop
                      ? pickupStop.monthlyFee != null
                        ? t('feeHint', { stop: pickupStop.name, amount: formatINR(Number(pickupStop.monthlyFee), { symbol: true }) })
                        : t('feeHintNone')
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={fee}
                    onChange={(e) => {
                      setFee(e.target.value);
                      setFeeTouched(true);
                    }}
                    className="tabular"
                    required
                  />
                </Field>
              </FieldGrid>

              <div>
                <Checkbox label={t('exemption')} checked={exemption} onChange={(e) => setExemption(e.target.checked)} />
                {exemption && (
                  <div className="mt-3 space-y-4 rounded-lg border border-line bg-surface-secondary p-3.5">
                    <Field label={t('exemptionType')}>
                      <SegmentedControl
                        value={exType}
                        onValueChange={setExType}
                        options={[
                          { value: 'PERCENT', label: t('percent') },
                          { value: 'FLAT', label: t('flat') },
                        ]}
                      />
                    </Field>
                    <FieldGrid>
                      <Field label={exType === 'PERCENT' ? t('exemptionValuePercent') : t('exemptionValueFlat')} required>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          max={exType === 'PERCENT' ? 100 : feeNumber || undefined}
                          step="0.01"
                          value={exValue}
                          onChange={(e) => setExValue(e.target.value)}
                          className="tabular"
                          required
                        />
                      </Field>
                      <Field label={t('exemptionReason')} required={!unchangedExemption}>
                        <Input
                          value={exReason}
                          onChange={(e) => setExReason(e.target.value)}
                          placeholder={t('exemptionReasonPlaceholder')}
                          required={!unchangedExemption}
                          maxLength={500}
                        />
                      </Field>
                    </FieldGrid>
                    {off > 0 && (
                      <p className="text-[13px] text-ink">
                        {t('exemptionPreview', {
                          off: formatINR(off, { symbol: true }),
                          net: formatINR(Math.max(0, feeNumber - off), { symbol: true }),
                        })}
                      </p>
                    )}
                    {!canApprove && !unchangedExemption && <Note pigment="attn">{t('needsApproval')}</Note>}
                  </div>
                )}
              </div>

              <Field label={t('remarks')}>
                <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} />
              </Field>
            </div>

            <DialogFooter className="mt-5">
              <Button type="button" variant="ghost" onClick={onClose}>
                {tc('action.cancel')}
              </Button>
              <Button type="submit" disabled={saving || (!isChange && !student)}>
                {saving ? t('saving') : isChange ? t('saveChange') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Debounced server-side student search, by name or admission number. */
function StudentPicker({ value, onChange }: { value: StudentHit | null; onChange: (s: StudentHit | null) => void }) {
  const t = useTranslations('transport.assignForm');
  const [query, setQuery] = React.useState('');
  const [results, setHits] = React.useState<StudentHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const active = !value && query.trim().length >= 2;
  const hits = active ? results : [];

  React.useEffect(() => {
    if (!active) return;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query.trim(), page: '1', limit: '8' });
        const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setHits(data?.data ?? (Array.isArray(data) ? data : []));
        }
      } catch {
        // The list just stays empty; typing again retries.
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, active]);

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line bg-surface-secondary px-3 py-2">
        <span className="min-w-0 truncate text-[14px] text-ink">{studentLabel(value)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-inset hover:text-ink"
          aria-label={t('changeStudent')}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // Show "searching", not a stale "no match", until the debounce fires.
          if (e.target.value.trim().length >= 2) setSearching(true);
        }}
        placeholder={t('searchStudent')}
        className="pl-9"
        autoFocus
      />
      {query.trim().length >= 2 && !searching && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-soft">
          {hits.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-muted">{t('noStudents')}</li>
          ) : (
            hits.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setQuery('');
                  }}
                  className="block min-h-11 w-full px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-surface-secondary"
                >
                  {studentLabel(s)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
