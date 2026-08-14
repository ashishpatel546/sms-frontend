'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { HandCoins } from 'lucide-react';

import {
  collectSalePayment,
  errorMessage,
  fetchSale,
  waiveSaleBalance,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  type InventoryPaymentMode,
} from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader, Detail, DetailGrid } from '@/components/ui/Panel';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AuthorizerPicker from '@/components/inventory/AuthorizerPicker';

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: sale, mutate } = useSWR(id ? `/inventory/sales/${id}` : null, () => fetchSale(id));

  const [collecting, setCollecting] = React.useState(false);
  const [waiving, setWaiving] = React.useState(false);

  if (!sale) {
    return (
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      </PageShell>
    );
  }

  const open = sale.status === 'DUE' || sale.status === 'PARTIAL';

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Inventory"
        backHref="/dashboard/inventory/sales"
        title={sale.receiptNumber}
        description={new Date(sale.createdAt).toLocaleString('en-IN')}
        meta={<StatusChip status={sale.status} size="md" />}
        actions={
          open ? (
            <>
              <Button variant="outline" onClick={() => setCollecting(true)}><HandCoins /> Collect payment</Button>
              <Button variant="destructive" onClick={() => setWaiving(true)}>Waive balance</Button>
            </>
          ) : undefined
        }
      />

      <PageBody className="space-y-4">
        <Panel>
          <PanelHeader title="Buyer" />
          <PanelBody>
            <DetailGrid columns={3}>
              <Detail label="Name">{sale.buyerName}</Detail>
              <Detail label="Type">{sale.buyerType}</Detail>
              <Detail label="Mobile">{sale.buyerMobile ?? '—'}</Detail>
            </DetailGrid>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Items" />
          <PanelBody className="p-0">
            <ul className="divide-y divide-line">
              {sale.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]">
                  <div>
                    <p className="font-medium text-ink">{l.itemName}</p>
                    <p className="text-[12px] text-ink-muted">{l.itemCode} · Qty {l.qty} · <Money amount={l.unitPrice} symbol /> each</p>
                  </div>
                  <Money amount={l.lineTotal} symbol />
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Money" />
          <PanelBody>
            <DetailGrid columns={4}>
              <Detail label="Gross"><Money amount={sale.grossAmount} symbol /></Detail>
              <Detail label="Discount"><Money amount={sale.discountAmount} symbol /></Detail>
              <Detail label="Net"><Money amount={sale.netAmount} symbol /></Detail>
              <Detail label="Balance"><Money amount={sale.balanceAmount} symbol tone={sale.balanceAmount > 0 ? 'owing' : 'settled'} /></Detail>
            </DetailGrid>
            {sale.discountAmount > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-muted">
                Discount permitted by {sale.discountPermittedBy ? `${sale.discountPermittedBy.firstName} ${sale.discountPermittedBy.lastName}` : '—'}
                {sale.discountReason ? ` — ${sale.discountReason}` : ''}
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Payments" />
          <PanelBody className="p-0">
            {sale.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13.5px] text-ink-muted">No payments collected yet</p>
            ) : (
              <ul className="divide-y divide-line">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]">
                    <div>
                      <p className="font-medium text-ink">{PAYMENT_MODE_LABELS[p.mode]}{p.reference ? ` · ${p.reference}` : ''}</p>
                      <p className="text-[12px] text-ink-muted">
                        {new Date(p.createdAt).toLocaleString('en-IN')}
                        {p.collectedBy ? ` · by ${p.collectedBy.firstName} ${p.collectedBy.lastName}` : ''}
                      </p>
                    </div>
                    <Money amount={p.amount} symbol />
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        {sale.waivers.length > 0 && (
          <Panel>
            <PanelHeader title="Waived off" />
            <PanelBody className="p-0">
              <ul className="divide-y divide-line">
                {sale.waivers.map((w) => (
                  <li key={w.id} className="px-4 py-2.5 text-[13.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{w.reason}</span>
                      <Money amount={w.amount} symbol tone="owing" />
                    </div>
                    <p className="text-[12px] text-ink-muted">
                      {new Date(w.createdAt).toLocaleString('en-IN')}
                      {w.permittedBy ? ` · permitted by ${w.permittedBy.firstName} ${w.permittedBy.lastName}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        )}
      </PageBody>

      {collecting && (
        <CollectPaymentDialog
          balance={sale.balanceAmount}
          onClose={() => setCollecting(false)}
          onSave={async (dto) => {
            await collectSalePayment(sale.id, dto);
            toast.success('Payment recorded');
            setCollecting(false);
            mutate();
          }}
        />
      )}

      {waiving && (
        <WaiveDialog
          balance={sale.balanceAmount}
          onClose={() => setWaiving(false)}
          onSave={async (dto) => {
            await waiveSaleBalance(sale.id, dto);
            toast.success('Balance waived');
            setWaiving(false);
            mutate();
          }}
        />
      )}
    </PageShell>
  );
}

function CollectPaymentDialog({
  balance,
  onClose,
  onSave,
}: {
  balance: number;
  onClose: () => void;
  onSave: (dto: { amount: number; mode: InventoryPaymentMode; reference?: string; remarks?: string }) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(String(balance));
  const [mode, setMode] = React.useState<InventoryPaymentMode>('CASH');
  const [reference, setReference] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0 || n > balance) { toast.error('Enter a valid amount up to the balance due'); return; }
    setSaving(true);
    try {
      await onSave({ amount: n, mode, reference: reference || undefined, remarks: remarks || undefined });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Collect payment</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">Balance due: <Money amount={balance} symbol tone="owing" /></p>
            <Field label="Amount" required>
              <Input type="number" min="0.01" step="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label="Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value as InventoryPaymentMode)}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
              </Select>
            </Field>
            <Field label="Reference">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Remarks">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WaiveDialog({
  balance,
  onClose,
  onSave,
}: {
  balance: number;
  onClose: () => void;
  onSave: (dto: { amount: number; reason: string; permittedByUserId: number }) => Promise<void>;
}) {
  const [amount, setAmount] = React.useState(String(balance));
  const [reason, setReason] = React.useState('');
  const [permittedBy, setPermittedBy] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0 || n > balance) { toast.error('Enter a valid amount up to the balance due'); return; }
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    if (!permittedBy) { toast.error('Select who permitted this waive-off'); return; }
    setSaving(true);
    try {
      await onSave({ amount: n, reason: reason.trim(), permittedByUserId: permittedBy });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not waive the balance'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Waive balance</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">Balance due: <Money amount={balance} symbol tone="owing" /></p>
            <Field label="Amount" required>
              <Input type="number" min="0.01" step="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label="Reason" required>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
            <Field label="Permitted by" required>
              <AuthorizerPicker value={permittedBy} onChange={(id) => setPermittedBy(id)} placeholder="Who authorized this waive-off?" />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving}>{saving ? 'Saving…' : 'Waive balance'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
