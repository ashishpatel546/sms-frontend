'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { HandCoins } from 'lucide-react';

import {
  collectSalePayment,
  errorMessage,
  fetchSale,
  waiveSaleBalance,
  PAYMENT_MODES,
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
import { INTL_LOCALE, type Locale } from '@/i18n/config';

export default function SaleDetailPage() {
  const t = useTranslations('inventory.saleDetail');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
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
        section={t('section')}
        backHref="/dashboard/inventory/sales"
        title={sale.receiptNumber}
        description={new Date(sale.createdAt).toLocaleString(INTL_LOCALE[locale])}
        meta={<StatusChip status={sale.status} label={ti(`saleStatus.${sale.status}`)} size="md" />}
        actions={
          open ? (
            <>
              <Button variant="outline" onClick={() => setCollecting(true)}><HandCoins /> {t('collect')}</Button>
              <Button variant="destructive" onClick={() => setWaiving(true)}>{t('waive')}</Button>
            </>
          ) : undefined
        }
      />

      <PageBody className="space-y-4">
        <Panel>
          <PanelHeader title={t('buyer')} />
          <PanelBody>
            <DetailGrid columns={3}>
              <Detail label={tc('field.name')}>{sale.buyerName}</Detail>
              <Detail label={tc('field.type')}>{ti(`buyerType.${sale.buyerType}`)}</Detail>
              <Detail label={tc('field.mobile')}>{sale.buyerMobile ?? '—'}</Detail>
            </DetailGrid>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title={t('items')} />
          <PanelBody className="p-0">
            <ul className="divide-y divide-line">
              {sale.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]">
                  <div>
                    <p className="font-medium text-ink">{l.itemName}</p>
                    <p className="text-[12px] text-ink-muted">{l.itemCode} · {t.rich('lineMeta', { qty: l.qty, price: () => <Money amount={l.unitPrice} symbol /> })}</p>
                  </div>
                  <Money amount={l.lineTotal} symbol />
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title={t('money')} />
          <PanelBody>
            <DetailGrid columns={4}>
              <Detail label={t('gross')}><Money amount={sale.grossAmount} symbol /></Detail>
              <Detail label={t('discount')}><Money amount={sale.discountAmount} symbol /></Detail>
              <Detail label={t('net')}><Money amount={sale.netAmount} symbol /></Detail>
              <Detail label={t('balance')}><Money amount={sale.balanceAmount} symbol tone={sale.balanceAmount > 0 ? 'owing' : 'settled'} /></Detail>
            </DetailGrid>
            {sale.discountAmount > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-muted">
                {t('discountPermittedBy', { name: sale.discountPermittedBy ? `${sale.discountPermittedBy.firstName} ${sale.discountPermittedBy.lastName}` : '—' })}
                {sale.discountReason ? ` — ${sale.discountReason}` : ''}
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title={t('payments')} />
          <PanelBody className="p-0">
            {sale.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13.5px] text-ink-muted">{t('noPayments')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]">
                    <div>
                      <p className="font-medium text-ink">{ti(`paymentMode.${p.mode}`)}{p.reference ? ` · ${p.reference}` : ''}</p>
                      <p className="text-[12px] text-ink-muted">
                        {new Date(p.createdAt).toLocaleString(INTL_LOCALE[locale])}
                        {p.collectedBy ? ` · ${t('by', { name: `${p.collectedBy.firstName} ${p.collectedBy.lastName}` })}` : ''}
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
            <PanelHeader title={t('waivedOff')} />
            <PanelBody className="p-0">
              <ul className="divide-y divide-line">
                {sale.waivers.map((w) => (
                  <li key={w.id} className="px-4 py-2.5 text-[13.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{w.reason}</span>
                      <Money amount={w.amount} symbol tone="owing" />
                    </div>
                    <p className="text-[12px] text-ink-muted">
                      {new Date(w.createdAt).toLocaleString(INTL_LOCALE[locale])}
                      {w.permittedBy ? ` · ${t('permittedBy', { name: `${w.permittedBy.firstName} ${w.permittedBy.lastName}` })}` : ''}
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
            toast.success(t('paymentRecorded'));
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
            toast.success(t('waived'));
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
  const t = useTranslations('inventory.collect');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const [mode, setMode] = React.useState<InventoryPaymentMode>('CASH');
  const [reference, setReference] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0 || n > balance) { toast.error(t('invalidAmount')); return; }
    setSaving(true);
    try {
      await onSave({ amount: n, mode, reference: reference || undefined, remarks: remarks || undefined });
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('title')}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">{t.rich('balanceDue', { amount: () => <Money amount={balance} symbol tone="owing" /> })}</p>
            <Field label={tc('field.amount')} required>
              <Input type="number" min="0.01" step="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label={t('mode')}>
              <Select value={mode} onChange={(e) => setMode(e.target.value as InventoryPaymentMode)}>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{ti(`paymentMode.${m}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('reference')}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label={tc('field.remarks')}>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc('action.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? tc('action.saving') : t('submit')}</Button>
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
  const t = useTranslations('inventory.waive');
  const tc = useTranslations('common');
  const [reason, setReason] = React.useState('');
  const [permittedBy, setPermittedBy] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0 || n > balance) { toast.error(t('invalidAmount')); return; }
    if (!reason.trim()) { toast.error(t('reasonRequired')); return; }
    if (!permittedBy) { toast.error(t('selectPermitter')); return; }
    setSaving(true);
    try {
      await onSave({ amount: n, reason: reason.trim(), permittedByUserId: permittedBy });
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('title')}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">{t.rich('balanceDue', { amount: () => <Money amount={balance} symbol tone="owing" /> })}</p>
            <Field label={tc('field.amount')} required>
              <Input type="number" min="0.01" step="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label={t('reason')} required>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
            <Field label={t('permittedBy')} required>
              <AuthorizerPicker value={permittedBy} onChange={(id) => setPermittedBy(id)} placeholder={t('permittedByPlaceholder')} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc('action.cancel')}</Button>
            <Button type="submit" variant="destructive" disabled={saving}>{saving ? tc('action.saving') : t('title')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
