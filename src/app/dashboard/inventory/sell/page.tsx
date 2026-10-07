'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { Minus, Plus, Printer, Trash2, User, Users, UserRoundSearch } from 'lucide-react';

import { fetcher } from '@/lib/api';
import {
  createSale,
  errorMessage,
  PAYMENT_MODES,
  type InventoryBuyerType,
  type InventoryItem,
  type InventoryPaymentMode,
  type InventorySale,
} from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Field, FieldGrid, Input } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import ItemFinder from '@/components/inventory/ItemFinder';
import StudentPicker from '@/components/inventory/StudentPicker';
import StaffPicker from '@/components/StaffPicker';
import AuthorizerPicker from '@/components/inventory/AuthorizerPicker';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

interface CartLine {
  itemId: number;
  name: string;
  code: string;
  sellingPrice: number;
  availableQty: number;
  qty: number;
}

export default function SellCounterPage() {
  const t = useTranslations('inventory.sell');
  const tc = useTranslations('common');
  const ti = useTranslations('inventory');
  const router = useRouter();
  const [cart, setCart] = React.useState<CartLine[]>([]);

  const [buyerType, setBuyerType] = React.useState<InventoryBuyerType>('STUDENT');
  const [studentId, setStudentId] = React.useState<number | null>(null);
  const [staffId, setStaffId] = React.useState<number | null>(null);
  const [walkInName, setWalkInName] = React.useState('');
  const [walkInMobile, setWalkInMobile] = React.useState('');

  const [discountAmount, setDiscountAmount] = React.useState('');
  const [discountPermittedBy, setDiscountPermittedBy] = React.useState<number | null>(null);
  const [discountReason, setDiscountReason] = React.useState('');

  const [paymentType, setPaymentType] = React.useState<'full' | 'partial' | 'none'>('full');
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentMode, setPaymentMode] = React.useState<InventoryPaymentMode>('CASH');
  const [paymentReference, setPaymentReference] = React.useState('');
  const [paymentRemarks, setPaymentRemarks] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<InventorySale | null>(null);

  const gross = cart.reduce((sum, l) => sum + l.sellingPrice * l.qty, 0);
  const discount = Math.min(Number(discountAmount) || 0, gross);
  const net = Math.round((gross - discount) * 100) / 100;
  const amountNow =
    paymentType === 'full' ? net : paymentType === 'partial' ? Math.min(Number(paymentAmount) || 0, net) : 0;
  const balance = Math.round((net - amountNow) * 100) / 100;

  /** Adds one unit; false when stock refuses. Toasts belong to the caller. */
  const addToCart = (item: InventoryItem): boolean => {
    const existing = cart.find((l) => l.itemId === item.id);
    if (existing) {
      if (existing.qty >= item.availableQty) {
        toast.error(t('onlyAvailable', { count: item.availableQty, name: item.name }));
        return false;
      }
      setCart(cart.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l)));
      return true;
    }
    if (item.availableQty <= 0) {
      toast.error(t('outOfStock', { name: item.name }));
      return false;
    }
    setCart([
      ...cart,
      { itemId: item.id, name: item.name, code: item.code, sellingPrice: Number(item.sellingPrice), availableQty: item.availableQty, qty: 1 },
    ]);
    return true;
  };

  /** What the finder hands back — scanned, typed, or chosen from a name search. */
  const onPickItem = (item: InventoryItem): boolean => {
    const added = addToCart(item);
    if (added) toast.success(t('added', { name: item.name }));
    return added;
  };

  const setQty = (itemId: number, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: Math.max(0, Math.min(qty, l.availableQty)) } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const removeLine = (itemId: number) => setCart((prev) => prev.filter((l) => l.itemId !== itemId));

  const resetForm = () => {
    setCart([]);
    setBuyerType('STUDENT');
    setStudentId(null);
    setStaffId(null);
    setWalkInName('');
    setWalkInMobile('');
    setDiscountAmount('');
    setDiscountPermittedBy(null);
    setDiscountReason('');
    setPaymentType('full');
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentRemarks('');
    setReceipt(null);
  };

  const canSubmit =
    cart.length > 0 &&
    (buyerType === 'STUDENT' ? !!studentId : buyerType === 'STAFF' ? !!staffId : walkInName.trim().length > 0) &&
    !(discount > 0 && !discountPermittedBy) &&
    !(buyerType === 'WALK_IN' && balance > 0 && !walkInMobile.trim());

  const submit = async () => {
    if (!canSubmit) {
      toast.error(t('fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const sale = await createSale({
        buyerType,
        studentId: buyerType === 'STUDENT' ? studentId! : undefined,
        staffId: buyerType === 'STAFF' ? staffId! : undefined,
        buyerName: buyerType === 'WALK_IN' ? walkInName.trim() : undefined,
        buyerMobile: buyerType === 'WALK_IN' ? walkInMobile.trim() || undefined : undefined,
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
        discountAmount: discount || undefined,
        discountPermittedByUserId: discount > 0 ? discountPermittedBy! : undefined,
        discountReason: discount > 0 ? discountReason || undefined : undefined,
        payment:
          paymentType !== 'none' && amountNow > 0
            ? { amount: amountNow, mode: paymentMode, reference: paymentReference || undefined, remarks: paymentRemarks || undefined }
            : undefined,
      });
      setReceipt(sale);
      toast.success(t('recorded', { receipt: sale.receiptNumber }));
    } catch (err) {
      toast.error(errorMessage(err, t('recordFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return <ReceiptView sale={receipt} onNewSale={resetForm} onViewSale={() => router.push(`/dashboard/inventory/sales/${receipt.id}`)} />;
  }

  return (
    <PageShell measure="reading">
      <Toaster position="top-center" />
      <PageHeader section={t('section')} title={t('title')} description={t('description')} />

      <PageBody className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t('scanOrSearch')} />
            <PanelBody>
              <ItemFinder
                onPick={onPickItem}
                submitLabel={tc('action.add')}
                scanLabel={cart.length > 0 ? t('scanNext') : t('openScanner')}
                autoFocus
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={t('cart')} description={cart.length ? t('itemCount', { count: cart.length }) : undefined} />
            <PanelBody>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-ink-muted">{t('cartEmpty')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {cart.map((line) => (
                    <li key={line.itemId} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{line.name}</p>
                        <p className="text-[12px] text-ink-muted">{line.code} · {t.rich('each', { price: () => <Money amount={line.sellingPrice} symbol /> })}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setQty(line.itemId, line.qty - 1)} className="grid size-8 place-items-center rounded-md border border-line-strong text-ink hover:bg-surface-secondary">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="tabular w-8 text-center text-[13.5px] font-semibold">{line.qty}</span>
                        <button type="button" onClick={() => setQty(line.itemId, line.qty + 1)} disabled={line.qty >= line.availableQty} className="grid size-8 place-items-center rounded-md border border-line-strong text-ink hover:bg-surface-secondary disabled:opacity-40">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="w-20 text-right"><Money amount={line.sellingPrice * line.qty} symbol /></div>
                      <button type="button" onClick={() => removeLine(line.itemId)} className="text-ink-faint hover:text-accent-danger-deep">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          {/* overflow-visible, or the picker dropdowns render clipped inside
              the panel ("hidden behind the box") — Panel is overflow-hidden by
              default for its rounded corners, so the header re-rounds itself. */}
          <Panel className="overflow-visible">
            <PanelHeader title={t('buyer')} className="rounded-t-[11px]" />
            <PanelBody className="space-y-3">
              <SegmentedControl
                value={buyerType}
                onValueChange={(v) => setBuyerType(v as InventoryBuyerType)}
                options={[
                  { value: 'STUDENT', label: tc('field.student'), icon: <User /> },
                  { value: 'STAFF', label: t('staff'), icon: <Users /> },
                  { value: 'WALK_IN', label: t('walkIn'), icon: <UserRoundSearch /> },
                ]}
              />
              {buyerType === 'STUDENT' && <StudentPicker value={studentId} onChange={(id) => setStudentId(id)} />}
              {buyerType === 'STAFF' && (
                <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="" />
              )}
              {buyerType === 'WALK_IN' && (
                <FieldGrid columns={2}>
                  <Field label={tc('field.name')} required>
                    <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                  </Field>
                  <Field label={tc('field.mobile')} hint={balance > 0 ? t('mobileRequired') : undefined}>
                    <Input value={walkInMobile} onChange={(e) => setWalkInMobile(e.target.value)} />
                  </Field>
                </FieldGrid>
              )}
            </PanelBody>
          </Panel>

          <Panel className="overflow-visible">
            <PanelHeader title={t('discount')} className="rounded-t-[11px]" />
            <PanelBody className="space-y-3">
              <Field label={t('discountAmount')}>
                <Input type="number" min="0" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </Field>
              {discount > 0 && (
                <>
                  <Field label={t('permittedBy')} required>
                    <AuthorizerPicker value={discountPermittedBy} onChange={(id) => setDiscountPermittedBy(id)} placeholder={t('permittedByPlaceholder')} />
                  </Field>
                  <Field label={t('reason')}>
                    <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                  </Field>
                </>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={t('payment')} />
            <PanelBody className="space-y-3">
              <SegmentedControl
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as 'full' | 'partial' | 'none')}
                options={[
                  { value: 'full', label: t('payFull') },
                  { value: 'partial', label: t('payPartial') },
                  { value: 'none', label: t('payLater') },
                ]}
              />
              {paymentType === 'partial' && (
                <Field label={t('amountNow')}>
                  <Input type="number" min="0" step="0.01" max={net} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </Field>
              )}
              {paymentType !== 'none' && (
                <>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {PAYMENT_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`rounded-md border px-2 py-2 text-[12.5px] font-semibold transition-colors ${paymentMode === mode ? 'border-brand bg-brand-tint text-brand' : 'border-line-strong text-ink-muted hover:bg-surface-secondary'}`}
                      >
                        {ti(`paymentMode.${mode}`)}
                      </button>
                    ))}
                  </div>
                  <FieldGrid columns={2}>
                    <Field label={t('reference')} hint={t('referenceHint')}>
                      <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                    </Field>
                    <Field label={tc('field.remarks')}>
                      <Input value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)} />
                    </Field>
                  </FieldGrid>
                </>
              )}
            </PanelBody>
          </Panel>

          <Panel className="sticky bottom-3">
            <PanelBody className="space-y-2">
              <div className="flex justify-between text-[13px] text-ink-muted"><span>{t('gross')}</span><Money amount={gross} symbol /></div>
              {discount > 0 && <div className="flex justify-between text-[13px] text-ink-muted"><span>{t('discount')}</span><span>−<Money amount={discount} symbol /></span></div>}
              <div className="flex justify-between text-[15px] font-semibold text-ink"><span>{t('net')}</span><Money amount={net} symbol /></div>
              {balance > 0 && <div className="flex justify-between text-[13px] text-accent-warn-deep"><span>{t('balanceDue')}</span><Money amount={balance} symbol tone="owing" /></div>}
              <Button type="button" block size="lg" disabled={!canSubmit || submitting} onClick={submit} className="mt-2">
                {submitting ? t('recording') : t('complete', { amount: `₹${net.toFixed(2)}` })}
              </Button>
            </PanelBody>
          </Panel>
        </div>
      </PageBody>
    </PageShell>
  );
}

interface SchoolInfo {
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}

function ReceiptView({ sale, onNewSale, onViewSale }: { sale: InventorySale; onNewSale: () => void; onViewSale: () => void }) {
  // Same identity block the fee receipt carries — a counter slip with no
  // school name on it reads as scrap paper the moment it leaves the counter.
  const { data: school } = useSWR<SchoolInfo>('/school/info', fetcher);
  const t = useTranslations('inventory.receipt');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;

  return (
    <PageShell measure="reading">
      <Toaster position="top-center" />
      <div className="printable-area">
        <Panel>
          <div className="border-b border-line px-4 py-4 text-center">
            {school?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logoUrl} alt="" className="mx-auto mb-2 size-12 rounded-md object-contain" />
            )}
            <h1 className="font-display text-[18px] leading-tight font-semibold text-ink">
              {school?.name || ' '}
            </h1>
            {school?.tagline && <p className="mt-0.5 text-[12px] text-ink-muted">{school.tagline}</p>}
            {school?.address && <p className="mt-1 text-[12px] text-ink-muted">{school.address}</p>}
            {(school?.phone || school?.email) && (
              <p className="text-[12px] text-ink-muted">
                {[school.phone, school.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <PanelHeader title={t('title', { receipt: sale.receiptNumber })} description={new Date(sale.createdAt).toLocaleString(INTL_LOCALE[locale])} />
          <PanelBody className="space-y-3">
            <p className="text-[13.5px] text-ink"><span className="text-ink-muted">{t('buyer')}</span> {sale.buyerName}{sale.buyerMobile ? ` · ${sale.buyerMobile}` : ''}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {sale.lines.map((l) => (
                <li key={l.id} className="flex justify-between px-3 py-2 text-[13px]">
                  <span>{l.itemName} × {l.qty}</span>
                  <Money amount={l.lineTotal} symbol />
                </li>
              ))}
            </ul>
            <div className="space-y-1 text-[13.5px]">
              <div className="flex justify-between"><span className="text-ink-muted">{t('gross')}</span><Money amount={sale.grossAmount} symbol /></div>
              {sale.discountAmount > 0 && <div className="flex justify-between"><span className="text-ink-muted">{t('discount')}</span><Money amount={sale.discountAmount} symbol /></div>}
              <div className="flex justify-between font-semibold"><span>{t('net')}</span><Money amount={sale.netAmount} symbol /></div>
              <div className="flex justify-between"><span className="text-ink-muted">{t('paid')}</span><Money amount={sale.paidAmount} symbol /></div>
              {sale.balanceAmount > 0 && <div className="flex justify-between text-accent-warn-deep"><span>{t('balanceDue')}</span><Money amount={sale.balanceAmount} symbol tone="owing" /></div>}
            </div>
            <p className="border-t border-line pt-2 text-center text-[11px] text-ink-faint">
              {t('footer')}
            </p>
          </PanelBody>
        </Panel>
      </div>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer /> {tc('action.print')}</Button>
        <Button variant="outline" onClick={onViewSale}>{t('viewSale')}</Button>
        <Button onClick={onNewSale}>{t('newSale')}</Button>
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>
    </PageShell>
  );
}
