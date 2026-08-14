'use client';

import * as React from 'react';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';

import { errorMessage, fetchInventorySettings, updateInventorySettings } from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelFooter, PanelHeader } from '@/components/ui/Panel';
import { Field, FieldGrid, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';

interface SettingsOverrides {
  defaultLoanDays?: string;
  maxLoanDays?: string;
  receiptPrefix?: string;
}

export default function InventorySettingsPage() {
  const { data, mutate } = useSWR('/inventory/settings', fetchInventorySettings);
  // Local edits overlay the fetched values — no effect needed to seed the
  // form once data arrives, and no risk of clobbering an in-progress edit.
  const [overrides, setOverrides] = React.useState<SettingsOverrides>({});
  const defaultLoanDays = overrides.defaultLoanDays ?? (data ? String(data.defaultLoanDays) : '');
  const maxLoanDays = overrides.maxLoanDays ?? (data ? String(data.maxLoanDays) : '');
  const receiptPrefix = overrides.receiptPrefix ?? data?.receiptPrefix ?? '';
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateInventorySettings({
        defaultLoanDays: Number(defaultLoanDays),
        maxLoanDays: Number(maxLoanDays),
        receiptPrefix,
      });
      toast.success('Settings saved');
      setOverrides({});
      mutate();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell measure="reading">
      <Toaster position="top-center" />
      <PageHeader section="Inventory" title="Settings" description="Loan defaults and receipt numbering." />
      <PageBody>
        <form onSubmit={submit}>
          <Panel>
            <PanelHeader title="Borrow / lend defaults" />
            <PanelBody>
              <FieldGrid>
                <Field label="Default loan period (days)" hint="Used when no due date is entered at issue">
                  <Input type="number" min="1" max="365" value={defaultLoanDays} onChange={(e) => setOverrides((prev) => ({ ...prev, defaultLoanDays: e.target.value }))} required />
                </Field>
                <Field label="Maximum loan period (days)" hint="The furthest a due date can be pushed out">
                  <Input type="number" min="1" max="365" value={maxLoanDays} onChange={(e) => setOverrides((prev) => ({ ...prev, maxLoanDays: e.target.value }))} required />
                </Field>
              </FieldGrid>
            </PanelBody>
            <PanelHeader title="Receipts" />
            <PanelBody>
              <Field label="Receipt number prefix" hint='e.g. "INV" produces INV/2026-27/000123'>
                <Input value={receiptPrefix} onChange={(e) => setOverrides((prev) => ({ ...prev, receiptPrefix: e.target.value }))} maxLength={8} required />
              </Field>
            </PanelBody>
            <PanelFooter className="justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
            </PanelFooter>
          </Panel>
        </form>
      </PageBody>
    </PageShell>
  );
}
