'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';

import { createRoute, errorMessage, hhmm, updateRoute, type Route } from '@/lib/transport-api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldGrid, Input, Textarea } from '@/components/ui/Field';

export function RouteFormDialog({
  route,
  onClose,
  onSaved,
}: {
  route?: Route | null;
  onClose: () => void;
  onSaved: (r: Route) => void;
}) {
  const t = useTranslations('transport.routeForm');
  const tc = useTranslations('common');
  const [routeNumber, setRouteNumber] = React.useState(route?.routeNumber ?? '');
  const [name, setName] = React.useState(route?.name ?? '');
  const [morningStart, setMorningStart] = React.useState(hhmm(route?.morningStart) ?? '');
  const [eveningStart, setEveningStart] = React.useState(hhmm(route?.eveningStart) ?? '');
  const [notes, setNotes] = React.useState(route?.notes ?? '');
  const [isActive, setIsActive] = React.useState(route?.isActive ?? true);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      routeNumber: routeNumber.trim(),
      name: name.trim(),
      morningStart: morningStart || null,
      eveningStart: eveningStart || null,
      notes: notes.trim() || null,
      ...(route ? { isActive } : {}),
    };
    try {
      const saved = route ? await updateRoute(route.id, body) : await createRoute(body);
      toast.success(t('saved'));
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{route ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <FieldGrid>
              <Field label={t('routeNumber')} required>
                <Input value={routeNumber} onChange={(e) => setRouteNumber(e.target.value)} maxLength={20} required className="tabular" />
              </Field>
              <Field label={t('name')} required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} maxLength={100} required />
              </Field>
              <Field label={t('morningStart')}>
                <Input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} />
              </Field>
              <Field label={t('eveningStart')}>
                <Input type="time" value={eveningStart} onChange={(e) => setEveningStart(e.target.value)} />
              </Field>
            </FieldGrid>
            <Field label={t('notes')}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
            {route && <Checkbox label={t('active')} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
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
