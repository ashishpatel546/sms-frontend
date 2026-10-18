'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { Bus, Phone, Plus, UserMinus, UserPlus } from 'lucide-react';

import {
  assignCrew,
  createVehicle,
  endCrew,
  errorMessage,
  fetchCrewCandidates,
  fetchCrewHistory,
  fetchSettings,
  fetchVehicles,
  todayIst,
  updateVehicle,
  VEHICLE_TYPES,
  vehicleName,
  type CrewRole,
  type CrewSummary,
  type Vehicle,
  type VehicleDocument,
  type VehicleType,
} from '@/lib/transport-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldGrid, Fieldset, Input, Select, Textarea } from '@/components/ui/Field';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Note } from '@/components/ui/Panel';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StatusChip } from '@/components/ui/StatusChip';
import { ExpiryChip } from '@/components/transport/ExpiryChip';
import { daysUntil, useFormatDate } from '@/components/transport/format';
import { VehicleTrackerDialog } from '@/components/transport/live/VehicleTrackerDialog';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';

const DOCS: { key: VehicleDocument; field: 'fitnessExpiry' | 'insuranceExpiry' | 'pucExpiry' | 'permitExpiry' }[] = [
  { key: 'FITNESS', field: 'fitnessExpiry' },
  { key: 'INSURANCE', field: 'insuranceExpiry' },
  { key: 'PUC', field: 'pucExpiry' },
  { key: 'PERMIT', field: 'permitExpiry' },
];

export default function TransportVehiclesPage() {
  const t = useTranslations('transport.vehicles');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const { data: vehicles, isLoading, mutate } = useSWR('/transport/vehicles', fetchVehicles);
  const { data: settings } = useSWR('/transport/settings', fetchSettings);
  const reminderWindow = settings?.expiryReminderDays ?? 30;
  const today = todayIst();

  const [editing, setEditing] = React.useState<Vehicle | 'new' | null>(null);
  const [crewOf, setCrewOf] = React.useState<Vehicle | null>(null);
  const [trackerOf, setTrackerOf] = React.useState<Vehicle | null>(null);
  const liveOn = useFeatureFlag('transport_live_tracking').enabled === true;

  const person = (c: CrewSummary | null | undefined) =>
    c ? (
      <div className="min-w-0">
        <p className="truncate text-ink">{c.name}</p>
        {c.mobile && <p className="tabular text-[12px] text-ink-muted">{c.mobile}</p>}
      </div>
    ) : (
      <span className="text-[12.5px] text-accent-warn-deep">{t('nobody')}</span>
    );

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: t('col.vehicle'),
      card: 'title',
      accessor: (v) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{v.fleetNumber ?? v.registrationNumber}</p>
          <p className="tabular text-[12px] text-ink-muted">
            {v.fleetNumber ? v.registrationNumber : null}
            {v.makeModel ? `${v.fleetNumber ? ' · ' : ''}${v.makeModel}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('col.type'),
      card: 'meta',
      accessor: (v) => `${tt(`vehicleType.${v.type}`)} · ${v.capacity}`,
    },
    { key: 'driver', header: t('col.driver'), accessor: (v) => person(v.driver) },
    { key: 'assistant', header: t('col.assistant'), accessor: (v) => person(v.assistant) },
    {
      key: 'routes',
      header: t('col.routes'),
      hideBelow: 'lg',
      accessor: (v) => (v.routes?.length ? v.routes.map((r) => r.routeNumber).join(', ') : '—'),
    },
    {
      key: 'documents',
      header: t('col.documents'),
      accessor: (v) => {
        const due = DOCS.map((d) => ({ ...d, date: v[d.field] }))
          .filter((d) => d.date && daysUntil(d.date, today) <= reminderWindow)
          .sort((a, b) => daysUntil(a.date!, today) - daysUntil(b.date!, today));
        if (due.length === 0) return <span className="text-[12.5px] text-ink-muted">{t('documentsOk')}</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {due.map((d) => (
              <span key={d.key} className="inline-flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
                {tt(`document.${d.key}`)} <ExpiryChip daysLeft={daysUntil(d.date!, today)} />
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: '',
      card: 'trailing',
      accessor: (v) => (v.isActive ? null : <StatusChip size="sm" status="INACTIVE" label={t('inactive')} />),
    },
    {
      key: 'actions',
      header: tc('action.actions'),
      align: 'right',
      card: 'trailing',
      accessor: (v) => (
        <RowActionsMenu
          actions={[
            { label: t('menu.crew'), onSelect: () => setCrewOf(v) },
            ...(liveOn ? [{ label: t('menu.tracker'), onSelect: () => setTrackerOf(v) }] : []),
            { label: t('menu.edit'), onSelect: () => setEditing(v) },
          ]}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('add')}
          </Button>
        }
      />
      <PageBody>
        <DataTable
          columns={columns}
          data={vehicles}
          loading={isLoading}
          rowKey={(v) => v.id}
          onRowClick={(v) => setCrewOf(v)}
          emptyMessage={t('empty')}
          toolbar={
            <>
              <Bus className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('title')}</span>
              {vehicles && <TableCount>{vehicles.length}</TableCount>}
            </>
          }
        />
      </PageBody>

      {editing && (
        <VehicleFormDialog
          vehicle={editing === 'new' ? null : editing}
          reminderDays={reminderWindow}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}
      {crewOf && (
        <CrewDialog
          vehicle={vehicles?.find((v) => v.id === crewOf.id) ?? crewOf}
          onClose={() => setCrewOf(null)}
          onChanged={() => mutate()}
        />
      )}
      {trackerOf && <VehicleTrackerDialog vehicle={trackerOf} onClose={() => setTrackerOf(null)} />}
    </PageShell>
  );
}

function VehicleFormDialog({
  vehicle,
  reminderDays,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null;
  reminderDays: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.vehicleForm');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const [form, setForm] = React.useState({
    registrationNumber: vehicle?.registrationNumber ?? '',
    type: (vehicle?.type ?? 'BUS') as VehicleType,
    fleetNumber: vehicle?.fleetNumber ?? '',
    makeModel: vehicle?.makeModel ?? '',
    capacity: vehicle ? String(vehicle.capacity) : '',
    fitnessExpiry: vehicle?.fitnessExpiry ?? '',
    insuranceExpiry: vehicle?.insuranceExpiry ?? '',
    pucExpiry: vehicle?.pucExpiry ?? '',
    permitExpiry: vehicle?.permitExpiry ?? '',
    gpsDeviceId: vehicle?.gpsDeviceId ?? '',
    notes: vehicle?.notes ?? '',
    isActive: vehicle?.isActive ?? true,
  });
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      registrationNumber: form.registrationNumber,
      type: form.type,
      fleetNumber: form.fleetNumber.trim() || null,
      makeModel: form.makeModel.trim() || null,
      capacity: Number(form.capacity),
      fitnessExpiry: form.fitnessExpiry || null,
      insuranceExpiry: form.insuranceExpiry || null,
      pucExpiry: form.pucExpiry || null,
      permitExpiry: form.permitExpiry || null,
      gpsDeviceId: form.gpsDeviceId.trim() || null,
      notes: form.notes.trim() || null,
      ...(vehicle ? { isActive: form.isActive } : {}),
    };
    try {
      if (vehicle) await updateVehicle(vehicle.id, body);
      else await createVehicle(body);
      toast.success(t('saved'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="max-h-[85vh] overflow-x-hidden overflow-y-auto px-0.5">
          <DialogHeader>
            <DialogTitle>{vehicle ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-5">
            <FieldGrid>
              <Field label={t('registrationNumber')} required>
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())}
                  maxLength={20}
                  required
                  className="tabular uppercase"
                />
              </Field>
              <Field label={t('type')} required>
                <Select value={form.type} onChange={(e) => set('type', e.target.value as VehicleType)}>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {tt(`vehicleType.${v}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('fleetNumber')}>
                <Input value={form.fleetNumber} onChange={(e) => set('fleetNumber', e.target.value)} placeholder={t('fleetNumberPlaceholder')} maxLength={30} />
              </Field>
              <Field label={t('capacity')} required>
                <Input type="number" min={1} max={120} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required className="tabular" />
              </Field>
              <Field label={t('makeModel')} wide>
                <Input value={form.makeModel} onChange={(e) => set('makeModel', e.target.value)} maxLength={80} />
              </Field>
            </FieldGrid>

            <Fieldset legend={t('documents')} description={t('documentsHint', { days: reminderDays })}>
              <FieldGrid>
                {DOCS.map((d) => (
                  <Field key={d.key} label={tt(`document.${d.key}`)}>
                    <Input type="date" value={form[d.field]} onChange={(e) => set(d.field, e.target.value)} />
                  </Field>
                ))}
              </FieldGrid>
            </Fieldset>

            <FieldGrid>
              <Field label={t('gpsDeviceId')} hint={t('gpsDeviceIdHint')}>
                <Input value={form.gpsDeviceId} onChange={(e) => set('gpsDeviceId', e.target.value)} maxLength={64} />
              </Field>
            </FieldGrid>
            <Field label={t('notes')}>
              <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
            </Field>
            {vehicle && <Checkbox label={t('active')} checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('action.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tc('action.saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Who drives and who assists, with the full history. Replacing someone never
 * deletes their row: the server closes it the day before the change.
 */
function CrewDialog({ vehicle, onClose, onChanged }: { vehicle: Vehicle; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('transport.crew');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const formatDate = useFormatDate();
  const { data: history, mutate } = useSWR(`/transport/vehicles/${vehicle.id}/crew`, () => fetchCrewHistory(vehicle.id));
  const [mode, setMode] = React.useState<{ kind: 'assign' | 'end'; role: CrewRole } | null>(null);

  const refresh = () => {
    mutate();
    onChanged();
  };

  const slot = (role: CrewRole, c: CrewSummary | null | undefined) => (
    <div className="rounded-lg border border-line p-3">
      <p className="eyebrow">{tt(`crewRole.${role}`)}</p>
      {c ? (
        <>
          <p className="mt-1 text-[14px] font-medium text-ink">{c.name}</p>
          <p className="text-[12px] text-ink-muted">
            {c.mobile && (
              <a href={`tel:${c.mobile}`} className="tabular inline-flex items-center gap-1 text-accent-info-deep hover:underline">
                <Phone className="size-3" /> {c.mobile}
              </a>
            )}
            {c.mobile ? ' · ' : ''}
            {t('since', { date: formatDate(c.since) })}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-accent-warn-deep">{t('nobody')}</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="sm" variant={c ? 'outline' : 'primary'} onClick={() => setMode({ kind: 'assign', role })}>
          <UserPlus /> {c ? tc('action.edit') : tc('action.add')}
        </Button>
        {c && (
          <Button size="sm" variant="ghost" onClick={() => setMode({ kind: 'end', role })}>
            <UserMinus /> {tc('action.remove')}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title', { vehicle: vehicleName(vehicle) })}</DialogTitle>
        </DialogHeader>
        <div className="mt-3 max-h-[70vh] space-y-4 overflow-y-auto">
          {mode ? (
            <CrewChangeForm
              vehicle={vehicle}
              kind={mode.kind}
              role={mode.role}
              current={mode.role === 'DRIVER' ? vehicle.driver : vehicle.assistant}
              onCancel={() => setMode(null)}
              onDone={() => {
                setMode(null);
                refresh();
              }}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {slot('DRIVER', vehicle.driver)}
                {slot('ASSISTANT', vehicle.assistant)}
              </div>
              <div>
                <p className="eyebrow mb-2">{t('historyTitle')}</p>
                {!history || history.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">{t('historyEmpty')}</p>
                ) : (
                  <ol className="space-y-2">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-md border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] text-ink">
                            <span className="font-medium">{h.name}</span>
                            <span className="text-ink-muted"> · {tt(`crewRole.${h.role}`)}</span>
                          </span>
                          <StatusChip size="sm" pigment={h.status === 'ACTIVE' ? 'success' : 'neutral'} label={tt(`recordStatus.${h.status}`)} />
                        </div>
                        <p className="tabular text-[12px] text-ink-muted">
                          {h.endDate
                            ? t('period', { from: formatDate(h.startDate), to: formatDate(h.endDate) })
                            : t('since', { date: formatDate(h.startDate) })}
                          {h.changedBy ? ` · ${tt('routeDetail.changedBy', { name: h.changedBy })}` : ''}
                        </p>
                        {h.changeReason && <p className="mt-0.5 text-[12px] text-ink-faint">{h.changeReason}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
        {!mode && (
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('action.close')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CrewChangeForm({
  vehicle,
  kind,
  role,
  current,
  onCancel,
  onDone,
}: {
  vehicle: Vehicle;
  kind: 'assign' | 'end';
  role: CrewRole;
  current: CrewSummary | null | undefined;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('transport.crew');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const roleName = tt(`crewRole.${role}`);
  const { data: candidates } = useSWR(kind === 'assign' ? `/transport/crew-candidates?role=${role}` : null, () =>
    fetchCrewCandidates(role),
  );
  const [staffId, setStaffId] = React.useState<number | ''>('');
  const [date, setDate] = React.useState(todayIst());
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (kind === 'assign') {
        await assignCrew(vehicle.id, { role, staffId: Number(staffId), effectiveFrom: date, reason: reason.trim() || undefined });
        toast.success(t('saved', { role: roleName }));
      } else {
        await endCrew(vehicle.id, { role, lastDay: date, reason: reason.trim() || undefined });
        toast.success(t('ended', { role: roleName }));
      }
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="font-display text-[15px] font-semibold text-ink">
        {kind === 'end'
          ? t('endTitle', { role: roleName })
          : current
            ? t('replaceTitle', { role: roleName })
            : t('assignTitle', { role: roleName })}
      </p>
      {kind === 'assign' && (
        <Field label={t('person')} required>
          <SearchSelect
            value={staffId}
            onChange={setStaffId}
            placeholder={t('selectPerson')}
            required
            options={(candidates ?? [])
              .filter((c) => c.staffId !== current?.staffId)
              .map((c) => ({
                value: c.staffId,
                label: c.name,
                detail: c.mobile ?? undefined,
                keywords: c.mobile ?? undefined,
              }))}
          />
        </Field>
      )}
      <Field label={kind === 'end' ? t('lastDay') : t('effectiveFrom')} required>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label={t('reason')}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      {kind === 'assign' && current && <Note>{t('replaceHint', { name: current.name })}</Note>}
      {kind === 'assign' && candidates && candidates.length === 0 && <Note pigment="attn">{t('noStaffHint')}</Note>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tc('action.cancel')}
        </Button>
        <Button type="submit" variant={kind === 'end' ? 'destructive' : 'primary'} disabled={saving || (kind === 'assign' && !staffId)}>
          {saving ? tc('action.saving') : kind === 'end' ? t('end') : t('save')}
        </Button>
      </div>
    </form>
  );
}
