'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowDown, ArrowUp, Bus, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  addStop,
  assignRouteVehicle,
  errorMessage,
  fetchRoute,
  fetchRouteVehicleHistory,
  fetchRoutes,
  fetchVehicles,
  hhmm,
  removeStop,
  reorderStops,
  todayIst,
  updateStop,
  vehicleName,
  type Stop,
} from '@/lib/transport-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox, Field, FieldGrid, Input, Select } from '@/components/ui/Field';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { RouteFormDialog } from '@/components/transport/RouteFormDialog';
import { useFormatDate } from '@/components/transport/format';
import type { LatLng } from '@/components/transport/StopMapPicker';

const StopMapPicker = dynamic(() => import('@/components/transport/StopMapPicker'), { ssr: false });

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const routeId = Number(params.id);
  const t = useTranslations('transport.routeDetail');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');

  const { data: route, mutate } = useSWR(`/transport/routes/${routeId}`, () => fetchRoute(routeId));
  // The list endpoint carries the current vehicle and rider count.
  const { data: routes, mutate: mutateRoutes } = useSWR('/transport/routes', fetchRoutes);
  const summary = routes?.find((r) => r.id === routeId);

  const [editRoute, setEditRoute] = React.useState(false);
  const [stopForm, setStopForm] = React.useState<Stop | 'new' | null>(null);
  const [vehicleForm, setVehicleForm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const refresh = () => {
    mutate();
    mutateRoutes();
  };

  const move = async (index: number, delta: -1 | 1) => {
    if (!route || busy) return;
    const ids = route.stops.map((s) => s.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setBusy(true);
    try {
      await mutate(reorderStops(routeId, ids), { revalidate: false });
    } catch (err) {
      toast.error(errorMessage(err, t('reorderFailed')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (stop: Stop) => {
    if (!window.confirm(t('removeConfirm', { name: stop.name }))) return;
    try {
      const r = await removeStop(routeId, stop.id);
      toast.success(r.removed ? t('removed') : t('deactivated'));
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, t('removeFailed')));
    }
  };

  if (!route) {
    return (
      <PageShell>
        <PageHeader section={tt('section')} title={tc('state.loading')} backHref="/dashboard/transport/routes" backLabel={t('back')} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={tt('section')}
        title={`${route.routeNumber} · ${route.name}`}
        description={tt('routes.times', { morning: hhmm(route.morningStart) ?? '—', evening: hhmm(route.eveningStart) ?? '—' })}
        backHref="/dashboard/transport/routes"
        backLabel={t('back')}
        actions={
          <Button variant="outline" onClick={() => setEditRoute(true)}>
            <Pencil /> {t('edit')}
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel>
            <PanelHeader
              title={t('stopsTitle')}
              description={t('stopsHint')}
              action={
                <Button size="sm" onClick={() => setStopForm('new')}>
                  <Plus /> {t('addStop')}
                </Button>
              }
            />
            <PanelBody>
              {route.stops.length === 0 ? (
                <EmptyState compact icon={<MapPin />} title={t('noStops')} />
              ) : (
                <ol className="divide-y divide-line">
                  {route.stops.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-inset font-mono text-[12px] tabular text-ink-muted">
                        {s.sequence}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium text-ink">
                          {s.name}
                          {!s.isActive && <StatusChip size="sm" status="INACTIVE" />}
                          {s.latitude == null && <MapPin className="size-3.5 text-ink-faint" aria-hidden />}
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          {[
                            s.pickupTime && t('pickup', { time: hhmm(s.pickupTime)! }),
                            s.dropTime && t('drop', { time: hhmm(s.dropTime)! }),
                            s.landmark,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {s.monthlyFee != null && (
                        <span className="hidden text-[13px] sm:inline">
                          <Money amount={s.monthlyFee} symbol />
                        </span>
                      )}
                      <div className="flex shrink-0 items-center">
                        <IconButton label={t('moveUp')} variant="ghost" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                          <ArrowUp />
                        </IconButton>
                        <IconButton label={t('moveDown')} variant="ghost"
                          disabled={i === route.stops.length - 1 || busy}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </IconButton>
                        <IconButton label={t('editStop')} variant="ghost" onClick={() => setStopForm(s)}>
                          <Pencil />
                        </IconButton>
                        <IconButton label={t('removeStop')} variant="ghost" onClick={() => remove(s)}>
                          <Trash2 />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </PanelBody>
          </Panel>

          <VehiclePanel
            routeId={routeId}
            current={summary?.vehicle ?? null}
            riders={summary?.riders ?? 0}
            onChange={() => setVehicleForm(true)}
            open={vehicleForm}
            onClose={() => setVehicleForm(false)}
            onSaved={() => {
              setVehicleForm(false);
              refresh();
            }}
          />
        </div>
      </PageBody>

      {editRoute && (
        <RouteFormDialog
          route={route}
          onClose={() => setEditRoute(false)}
          onSaved={() => {
            setEditRoute(false);
            refresh();
          }}
        />
      )}
      {stopForm && (
        <StopFormDialog
          routeId={routeId}
          stop={stopForm === 'new' ? null : stopForm}
          others={route.stops.filter((s) => (stopForm === 'new' || s.id !== stopForm.id) && s.latitude != null && s.longitude != null)}
          onClose={() => setStopForm(null)}
          onSaved={() => {
            setStopForm(null);
            refresh();
          }}
        />
      )}
    </PageShell>
  );
}

function VehiclePanel({
  routeId,
  current,
  riders,
  onChange,
  open,
  onClose,
  onSaved,
}: {
  routeId: number;
  current: { id: number; registrationNumber: string; fleetNumber: string | null; capacity: number; since: string } | null;
  riders: number;
  onChange: () => void;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.routeDetail');
  const tt = useTranslations('transport');
  const formatDate = useFormatDate();
  const { data: history, mutate } = useSWR(`/transport/routes/${routeId}/vehicles`, () => fetchRouteVehicleHistory(routeId));

  return (
    <Panel>
      <PanelHeader
        title={t('vehicleTitle')}
        action={
          <Button size="sm" variant={current ? 'outline' : 'primary'} onClick={onChange}>
            <Bus /> {current ? t('changeVehicle') : t('assignVehicle')}
          </Button>
        }
      />
      <PanelBody>
        {current ? (
          <div>
            <p className="font-display text-[16px] font-semibold text-ink">{vehicleName(current)}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {tt('routes.riders', { riders, capacity: current.capacity })} · {tt('crew.since', { date: formatDate(current.since) })}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-accent-warn-deep">{t('noVehicle')}</p>
        )}

        {history && history.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow mb-2">{t('historyTitle')}</p>
            <ol className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-md border border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">{vehicleName(h.vehicle)}</span>
                    <StatusChip size="sm" pigment={h.status === 'ACTIVE' ? 'success' : 'neutral'} label={tt(`recordStatus.${h.status}`)} />
                  </div>
                  <p className="tabular text-[12px] text-ink-muted">
                    {h.endDate
                      ? tt('crew.period', { from: formatDate(h.startDate), to: formatDate(h.endDate) })
                      : tt('crew.since', { date: formatDate(h.startDate) })}
                    {h.changedBy ? ` · ${t('changedBy', { name: h.changedBy })}` : ''}
                  </p>
                  {h.changeReason && <p className="mt-0.5 text-[12px] text-ink-faint">{h.changeReason}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </PanelBody>

      {open && (
        <RouteVehicleDialog
          routeId={routeId}
          currentId={current?.id}
          onClose={onClose}
          onSaved={() => {
            mutate();
            onSaved();
          }}
        />
      )}
    </Panel>
  );
}

function RouteVehicleDialog({
  routeId,
  currentId,
  onClose,
  onSaved,
}: {
  routeId: number;
  currentId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.routeDetail');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const { data: vehicles } = useSWR('/transport/vehicles', fetchVehicles);
  const [vehicleId, setVehicleId] = React.useState<number | ''>('');
  const [from, setFrom] = React.useState(todayIst());
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setSaving(true);
    try {
      await assignRouteVehicle(routeId, { vehicleId: Number(vehicleId), effectiveFrom: from, reason: reason.trim() || undefined });
      toast.success(t('vehicleSaved'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('vehicleFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{currentId ? t('changeVehicle') : t('assignVehicle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <Field label={t('vehicle')} required>
              <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">{tc('state.selectPlaceholder')}</option>
                {(vehicles ?? [])
                  .filter((v) => v.isActive && v.id !== currentId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleName(v)} · {tt(`vehicleType.${v.type}`)} · {v.capacity}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t('effectiveFrom')} required>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </Field>
            <Field label={t('reason')}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('action.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !vehicleId}>
              {saving ? tc('action.saving') : tc('action.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StopFormDialog({
  routeId,
  stop,
  others,
  onClose,
  onSaved,
}: {
  routeId: number;
  stop: Stop | null;
  others: Stop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('transport.stopForm');
  const tc = useTranslations('common');
  const [name, setName] = React.useState(stop?.name ?? '');
  const [landmark, setLandmark] = React.useState(stop?.landmark ?? '');
  const [pickupTime, setPickupTime] = React.useState(hhmm(stop?.pickupTime) ?? '');
  const [dropTime, setDropTime] = React.useState(hhmm(stop?.dropTime) ?? '');
  const [fee, setFee] = React.useState(stop?.monthlyFee != null ? String(Number(stop.monthlyFee)) : '');
  const [pin, setPin] = React.useState<LatLng | null>(
    stop?.latitude != null && stop?.longitude != null ? { lat: Number(stop.latitude), lng: Number(stop.longitude) } : null,
  );
  const [isActive, setIsActive] = React.useState(stop?.isActive ?? true);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: name.trim(),
      landmark: landmark.trim() || null,
      pickupTime: pickupTime || null,
      dropTime: dropTime || null,
      monthlyFee: fee === '' ? null : Number(fee),
      latitude: pin?.lat ?? null,
      longitude: pin?.lng ?? null,
      ...(stop ? { isActive } : {}),
    };
    try {
      if (stop) await updateStop(routeId, stop.id, body);
      else await addStop(routeId, body);
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
            <DialogTitle>{stop ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <FieldGrid>
              <Field label={t('name')} required>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
              </Field>
              <Field label={t('landmark')}>
                <Input value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={160} />
              </Field>
              <Field label={t('pickupTime')}>
                <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </Field>
              <Field label={t('dropTime')}>
                <Input type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} />
              </Field>
              <Field label={t('fee')} hint={t('feeHint')}>
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="tabular" />
              </Field>
            </FieldGrid>
            <Field label={t('location')} hint={t('locationHint')}>
              <StopMapPicker
                value={pin}
                onChange={setPin}
                others={others.map((o) => ({ lat: Number(o.latitude), lng: Number(o.longitude), name: o.name }))}
              />
              {pin && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="tabular text-[12px] text-ink-muted">
                    {pin.lat}, {pin.lng}
                  </span>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setPin(null)}>
                    {t('clearPin')}
                  </Button>
                </div>
              )}
            </Field>
            {stop && <Checkbox label={t('active')} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
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
