'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';

import { errorMessage, fetchSettings, updateSettings, type TransportSettings } from '@/lib/transport-api';
import { useRbac } from '@/lib/rbac';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, Note } from '@/components/ui/Panel';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid, Input, Select } from '@/components/ui/Field';

export default function TransportSettingsPage() {
  const t = useTranslations('transport.settings');
  const tt = useTranslations('transport');
  const tc = useTranslations('common');
  const rbac = useRbac();
  const { data, mutate } = useSWR('/transport/settings', fetchSettings);
  // Unsaved edits sit over the loaded settings; saving clears them.
  const [draft, setForm] = React.useState<TransportSettings | null>(null);
  const form = draft ?? data ?? null;
  const [saving, setSaving] = React.useState(false);

  // Billing rules change what parents are charged, so only admins edit them.
  const readOnly = !rbac.isAdmin;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || readOnly) return;
    setSaving(true);
    try {
      const saved = await updateSettings({
        defaultJoinBilling: form.defaultJoinBilling,
        leaveBilling: form.leaveBilling,
        exemptionApproverRole: form.exemptionApproverRole,
        expiryReminderDays: Number(form.expiryReminderDays),
      });
      await mutate(saved, { revalidate: false });
      setForm(null);
      toast.success(t('saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader section={tt('section')} title={t('title')} description={t('description')} />
      <PageBody>
        {form && (
          <Panel className="max-w-3xl">
            <PanelBody>
              <form onSubmit={submit} className="space-y-5">
                {readOnly && <Note pigment="info">{t('adminOnly')}</Note>}
                <FieldGrid>
                  <Field label={t('joinBilling')} hint={t('joinBillingHint')}>
                    <Select
                      value={form.defaultJoinBilling}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, defaultJoinBilling: e.target.value as TransportSettings['defaultJoinBilling'] })}
                    >
                      <option value="FULL">{tt('billing.FULL')}</option>
                      <option value="PRORATED">{tt('billing.PRORATED')}</option>
                    </Select>
                  </Field>
                  <Field label={t('leaveBilling')}>
                    <Select
                      value={form.leaveBilling}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, leaveBilling: e.target.value as TransportSettings['leaveBilling'] })}
                    >
                      <option value="FULL">{tt('billing.FULL')}</option>
                      <option value="PRORATED">{tt('billing.PRORATED')}</option>
                    </Select>
                  </Field>
                  <Field label={t('approver')} hint={t('approverHint')}>
                    <Select
                      value={form.exemptionApproverRole}
                      disabled={readOnly}
                      onChange={(e) =>
                        setForm({ ...form, exemptionApproverRole: e.target.value as TransportSettings['exemptionApproverRole'] })
                      }
                    >
                      {(['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] as const).map((r) => (
                        <option key={r} value={r}>
                          {t(`approverRole.${r}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('reminderDays')}>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={form.expiryReminderDays}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, expiryReminderDays: Number(e.target.value) })}
                      className="tabular"
                    />
                  </Field>
                </FieldGrid>
                {!readOnly && (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? tc('action.saving') : t('save')}
                    </Button>
                  </div>
                )}
              </form>
            </PanelBody>
          </Panel>
        )}
      </PageBody>
    </PageShell>
  );
}
