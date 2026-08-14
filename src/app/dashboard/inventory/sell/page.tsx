'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { Minus, Plus, Printer, ScanLine, Trash2, User, Users, UserRoundSearch } from 'lucide-react';

import { fetcher } from '@/lib/api';
import {
  createSale,
  errorMessage,
  lookupItem,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
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
import StableScanner from '@/components/inventory/StableScanner';
import { useKeyboardWedge } from '@/components/inventory/useKeyboardWedge';
import StudentPicker from '@/components/inventory/StudentPicker';
import StaffPicker from '@/components/StaffPicker';
import AuthorizerPicker from '@/components/inventory/AuthorizerPicker';

interface CartLine {
  itemId: number;
  name: string;
  code: string;
  sellingPrice: number;
  availableQty: number;
  qty: number;
}

export default function SellCounterPage() {
  const router = useRouter();
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [manualCode, setManualCode] = React.useState('');
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

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
        toast.error(`Only ${item.availableQty} of "${item.name}" available`);
        return false;
      }
      setCart(cart.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l)));
      return true;
    }
    if (item.availableQty <= 0) {
      toast.error(`"${item.name}" is out of stock`);
      return false;
    }
    setCart([
      ...cart,
      { itemId: item.id, name: item.name, code: item.code, sellingPrice: Number(item.sellingPrice), availableQty: item.availableQty, qty: 1 },
    ]);
    return true;
  };

  // Deliberately NOT memoized: both the scanner and the wedge hold the latest
  // callback in a ref, and this closure must see the current cart.
  const lookupAndAdd = async (code: string, { fromScanner = false } = {}) => {
    if (!code.trim()) return;
    setLookingUp(true);
    try {
      const item = await lookupItem(code.trim());
      const added = addToCart(item);
      if (added) {
        toast.success(`Added ${item.name}`);
        // One scan, one line. The camera kept running here once, and a book
        // held in front of it re-added itself until stock ran out — the exact
        // opposite of how a counter scanner behaves. Close, let the operator
        // see the cart change, and reopen for the next item on purpose.
        if (fromScanner) setScannerOpen(false);
      }
    } catch {
      toast.error(`No item found for "${code}"`);
    } finally {
      setLookingUp(false);
    }
  };

  useKeyboardWedge(lookupAndAdd, !receipt);

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
    setManualCode('');
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
      toast.error('Fill in the buyer and required fields first');
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
      toast.success(`Sale recorded — ${sale.receiptNumber}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the sale'));
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
      <PageHeader section="Inventory" title="Sell" description="Scan or search an item to add it to the cart." />

      <PageBody className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Scan or search" />
            <PanelBody className="space-y-3">
              {scannerOpen ? (
                <StableScanner
                  onCode={(code) => {
                    void lookupAndAdd(code, { fromScanner: true });
                  }}
                  onClose={() => setScannerOpen(false)}
                />
              ) : (
                <Button type="button" variant="outline" block onClick={() => setScannerOpen(true)}>
                  <ScanLine /> {cart.length > 0 ? 'Scan next item' : 'Open camera scanner'}
                </Button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  lookupAndAdd(manualCode);
                  setManualCode('');
                }}
                className="flex gap-2"
              >
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Type an item code, or scan with a USB/BT scanner"
                  autoFocus
                />
                <Button type="submit" disabled={lookingUp || !manualCode.trim()}>Add</Button>
              </form>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Cart" description={cart.length ? `${cart.length} item(s)` : undefined} />
            <PanelBody>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-ink-muted">Cart is empty — scan or search an item to begin</p>
              ) : (
                <ul className="divide-y divide-line">
                  {cart.map((line) => (
                    <li key={line.itemId} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{line.name}</p>
                        <p className="text-[12px] text-ink-muted">{line.code} · <Money amount={line.sellingPrice} symbol /> each</p>
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
            <PanelHeader title="Buyer" className="rounded-t-[11px]" />
            <PanelBody className="space-y-3">
              <SegmentedControl
                value={buyerType}
                onValueChange={(v) => setBuyerType(v as InventoryBuyerType)}
                options={[
                  { value: 'STUDENT', label: 'Student', icon: <User /> },
                  { value: 'STAFF', label: 'Staff', icon: <Users /> },
                  { value: 'WALK_IN', label: 'Walk-in', icon: <UserRoundSearch /> },
                ]}
              />
              {buyerType === 'STUDENT' && <StudentPicker value={studentId} onChange={(id) => setStudentId(id)} />}
              {buyerType === 'STAFF' && (
                <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="" />
              )}
              {buyerType === 'WALK_IN' && (
                <FieldGrid columns={2}>
                  <Field label="Name" required>
                    <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                  </Field>
                  <Field label="Mobile" hint={balance > 0 ? 'Required — a balance is left on this sale' : undefined}>
                    <Input value={walkInMobile} onChange={(e) => setWalkInMobile(e.target.value)} />
                  </Field>
                </FieldGrid>
              )}
            </PanelBody>
          </Panel>

          <Panel className="overflow-visible">
            <PanelHeader title="Discount" className="rounded-t-[11px]" />
            <PanelBody className="space-y-3">
              <Field label="Discount amount">
                <Input type="number" min="0" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </Field>
              {discount > 0 && (
                <>
                  <Field label="Permitted by" required>
                    <AuthorizerPicker value={discountPermittedBy} onChange={(id) => setDiscountPermittedBy(id)} placeholder="Who authorized this discount?" />
                  </Field>
                  <Field label="Reason">
                    <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                  </Field>
                </>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Payment" />
            <PanelBody className="space-y-3">
              <SegmentedControl
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as 'full' | 'partial' | 'none')}
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'none', label: 'Pay later' },
                ]}
              />
              {paymentType === 'partial' && (
                <Field label="Amount now">
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
                        {PAYMENT_MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                  <FieldGrid columns={2}>
                    <Field label="Reference" hint="UPI txn / cheque no.">
                      <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                    </Field>
                    <Field label="Remarks">
                      <Input value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)} />
                    </Field>
                  </FieldGrid>
                </>
              )}
            </PanelBody>
          </Panel>

          <Panel className="sticky bottom-3">
            <PanelBody className="space-y-2">
              <div className="flex justify-between text-[13px] text-ink-muted"><span>Gross</span><Money amount={gross} symbol /></div>
              {discount > 0 && <div className="flex justify-between text-[13px] text-ink-muted"><span>Discount</span><span>−<Money amount={discount} symbol /></span></div>}
              <div className="flex justify-between text-[15px] font-semibold text-ink"><span>Net</span><Money amount={net} symbol /></div>
              {balance > 0 && <div className="flex justify-between text-[13px] text-accent-warn-deep"><span>Balance due</span><Money amount={balance} symbol tone="owing" /></div>}
              <Button type="button" block size="lg" disabled={!canSubmit || submitting} onClick={submit} className="mt-2">
                {submitting ? 'Recording sale…' : `Complete sale · ₹${net.toFixed(2)}`}
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
          <PanelHeader title={`Receipt ${sale.receiptNumber}`} description={new Date(sale.createdAt).toLocaleString('en-IN')} />
          <PanelBody className="space-y-3">
            <p className="text-[13.5px] text-ink"><span className="text-ink-muted">Buyer:</span> {sale.buyerName}{sale.buyerMobile ? ` · ${sale.buyerMobile}` : ''}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {sale.lines.map((l) => (
                <li key={l.id} className="flex justify-between px-3 py-2 text-[13px]">
                  <span>{l.itemName} × {l.qty}</span>
                  <Money amount={l.lineTotal} symbol />
                </li>
              ))}
            </ul>
            <div className="space-y-1 text-[13.5px]">
              <div className="flex justify-between"><span className="text-ink-muted">Gross</span><Money amount={sale.grossAmount} symbol /></div>
              {sale.discountAmount > 0 && <div className="flex justify-between"><span className="text-ink-muted">Discount</span><Money amount={sale.discountAmount} symbol /></div>}
              <div className="flex justify-between font-semibold"><span>Net</span><Money amount={sale.netAmount} symbol /></div>
              <div className="flex justify-between"><span className="text-ink-muted">Paid</span><Money amount={sale.paidAmount} symbol /></div>
              {sale.balanceAmount > 0 && <div className="flex justify-between text-accent-warn-deep"><span>Balance due</span><Money amount={sale.balanceAmount} symbol tone="owing" /></div>}
            </div>
            <p className="border-t border-line pt-2 text-center text-[11px] text-ink-faint">
              School store receipt · Not a tax invoice
            </p>
          </PanelBody>
        </Panel>
      </div>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
        <Button variant="outline" onClick={onViewSale}>View sale</Button>
        <Button onClick={onNewSale}>New sale</Button>
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
