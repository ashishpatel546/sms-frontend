'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, IndianRupee, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { useRbac } from '@/lib/rbac';
import { downloadInvoicePdf, type InvoiceDetail } from '@/lib/billing-invoice-pdf';

interface BillingSummary {
  schoolStatus: string | null;
  plan: {
    id: number;
    name: string;
    description: string | null;
    pricePerStudentPaise: number;
  } | null;
  subscription: {
    frequency: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    baselineStudentCount: number;
    isTrial: boolean;
    trialEndsAt: string | null;
  } | null;
  billableStudents: number;
  outstandingPaise: number;
  outstandingCount: number;
  overdueCount: number;
  nextDueDate: string | null;
  suspendOn: string | null;
  /** Money we hold that belongs to this school. */
  creditBalancePaise: number;
  gstEnabled: boolean;
}

interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  type: 'PERIOD' | 'TRUEUP';
  periodStart: string;
  periodEnd: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
  studentCount: number;
  totalPaise: number;
  /** What is still owed after payments, credit, write-offs and refunds. */
  balancePaise: number;
  settledPaise: number;
  amountRefundedPaise: number;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  settlement: {
    amountPaidPaise: number;
    couponCode: string | null;
    couponDiscountPaise: number;
  } | null;
}

const STATUS_STYLES: Record<InvoiceRow['status'], string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  PAID: 'paid',
  PARTIALLY_PAID: 'partiallyPaid',
  PENDING: 'pending',
  OVERDUE: 'overdue',
  VOID: 'void',
} as const satisfies Record<InvoiceRow['status'], string>;

const FREQUENCY_LABELS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  HALF_YEARLY: 'halfYearly',
  ANNUAL: 'annual',
} as const;

function formatRupees(paise: number, intl: string): string {
  return (paise / 100).toLocaleString(intl, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function formatDateIn(value: string | null, intl: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(intl, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Loads the Razorpay checkout script on demand. */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const t = useTranslations('fees.billing');
  const tc = useTranslations('common');
  const intl = INTL_LOCALE[useLocale() as Locale];
  const rupees = (paise: number) => formatRupees(paise, intl);
  const formatDate = (value: string | null) => formatDateIn(value, intl);
  const rbac = useRbac();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState<Record<number, string>>({});
  const [appliedCoupon, setAppliedCoupon] = useState<
    Record<number, { code: string; discountPaise: number }>
  >({});
  const [checkingCoupon, setCheckingCoupon] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, invoicesRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/billing/summary`),
        authFetch(`${API_BASE_URL}/billing/invoices`),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (invoicesRes.ok) setInvoices(await invoicesRes.json());
    } catch {
      toast.error(t('toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (rbac.isAdmin) void load();
    else setLoading(false);
  }, [rbac.isAdmin, load]);

  /** Checks a code and shows the saving, without spending it. */
  const applyCoupon = async (invoice: InvoiceRow) => {
    const code = couponInput[invoice.id]?.trim();
    if (!code) return;
    setCheckingCoupon(invoice.id);
    try {
      const res = await authFetch(`${API_BASE_URL}/billing/apply-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? t('toast.couponInvalid'));
      setAppliedCoupon((current) => ({
        ...current,
        [invoice.id]: { code, discountPaise: body.discountPaise },
      }));
      toast.success(t('toast.couponApplied', { amount: rupees(body.discountPaise) }));
    } catch (e: unknown) {
      setAppliedCoupon((current) => {
        const next = { ...current };
        delete next[invoice.id];
        return next;
      });
      toast.error(e instanceof Error ? e.message : t('toast.couponInvalid'));
    } finally {
      setCheckingCoupon(null);
    }
  };

  const pay = async (invoice: InvoiceRow) => {
    if (payingId) return;
    setPayingId(invoice.id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error(t('toast.gatewayLoadFailed'));

      const orderRes = await authFetch(`${API_BASE_URL}/billing/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          couponCode: appliedCoupon[invoice.id]?.code,
        }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        // 409 means there is nothing left to pay — either the invoice was
        // settled elsewhere, or the coupon covered it entirely and the backend
        // closed it on the spot. Both are outcomes to show, not errors.
        if (orderRes.status === 409) {
          toast.success(body?.message ?? t('toast.alreadySettled'));
          setAppliedCoupon((current) => {
            const next = { ...current };
            delete next[invoice.id];
            return next;
          });
          await load();
          return;
        }
        throw new Error(body?.message ?? t('toast.startFailed'));
      }
      const order = await orderRes.json();

      await new Promise<void>((resolve, reject) => {
        // The key comes from the order response: NEXT_PUBLIC_ vars are baked
        // in at CI build time, where the right value is not available.
        const rzp = new window.Razorpay({
          key: order.razorpay_key_id,
          amount: order.amount_paise,
          currency: order.currency ?? 'INR',
          name: t('checkout.name'),
          description: t('checkout.description', { number: order.invoice_number }),
          order_id: order.razorpay_order_id,
          theme: { color: '#059669' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await authFetch(
                `${API_BASE_URL}/billing/verify-payment`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(response),
                },
              );
              if (!verifyRes.ok) {
                const body = await verifyRes.json().catch(() => ({}));
                throw new Error(
                  body?.message ??
                    t('toast.confirmFailed'),
                );
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.open();
      });

      toast.success(t('toast.paymentReceived'));
      setAppliedCoupon((current) => {
        const next = { ...current };
        delete next[invoice.id];
        return next;
      });
      setCouponInput((current) => ({ ...current, [invoice.id]: '' }));
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('toast.paymentFailed');
      if (message !== 'Payment cancelled.') toast.error(message);
    } finally {
      setPayingId(null);
    }
  };

  const download = async (invoice: InvoiceRow) => {
    setDownloadingId(invoice.id);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/billing/invoices/${invoice.id}`,
      );
      if (!res.ok) throw new Error();
      const detail = (await res.json()) as InvoiceDetail;
      await downloadInvoicePdf(detail);
    } catch {
      toast.error(t('toast.pdfFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!rbac.isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">
          {t('adminOnly')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const suspended = summary?.schoolStatus === 'SUSPENDED';
  const extraStudents = summary?.subscription
    ? summary.billableStudents - summary.subscription.baselineStudentCount
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {t('subtitle')}
        </p>
      </div>

      {suspended && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              {t('suspended.title')}
            </p>
            <p className="text-xs text-red-700 mt-1">
              {t('suspended.body')}
            </p>
          </div>
        </div>
      )}

      {!suspended && summary && summary.overdueCount > 0 && summary.suspendOn && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {t('overdue.title')}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {t('overdue.body', { date: formatDate(summary.suspendOn) })}
            </p>
          </div>
        </div>
      )}

      {summary?.plan ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {summary.plan.name}
                </h2>
                {summary.subscription?.isTrial && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold">
                    {t('plan.trial')}
                  </span>
                )}
              </div>
              {summary.plan.description && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {summary.plan.description}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {t('plan.pricing', {
                  price: rupees(summary.plan.pricePerStudentPaise),
                  frequency:
                    summary.subscription?.frequency &&
                    summary.subscription.frequency in FREQUENCY_LABELS
                      ? t(`frequency.${FREQUENCY_LABELS[summary.subscription.frequency as keyof typeof FREQUENCY_LABELS]}`)
                      : t('frequency.periodic'),
                })}
              </p>
              {summary.subscription?.isTrial &&
                summary.subscription.trialEndsAt && (
                  <p className="text-xs text-violet-700 mt-1">
                    {t('plan.trialUntil', { date: formatDate(summary.subscription.trialEndsAt) })}
                  </p>
                )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{t('plan.outstanding')}</p>
              <p
                className={`text-2xl font-bold ${
                  (summary.outstandingPaise ?? 0) > 0
                    ? 'text-red-600'
                    : 'text-emerald-600'
                }`}
              >
                {rupees(summary.outstandingPaise)}
              </p>
              {summary.nextDueDate && summary.outstandingPaise > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('plan.due', { date: formatDate(summary.nextDueDate) })}
                </p>
              )}
              {(summary.creditBalancePaise ?? 0) > 0 && (
                <p className="text-xs font-medium text-emerald-600 mt-1">
                  {t('plan.credit', { amount: rupees(summary.creditBalancePaise) })}
                </p>
              )}
            </div>
          </div>

          {(summary.creditBalancePaise ?? 0) > 0 && (
            <p className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
              {t('plan.creditNote', { amount: rupees(summary.creditBalancePaise) })}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400">{t('plan.studentsToday')}</p>
              <p className="text-base font-semibold text-gray-800">
                {summary.billableStudents}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('plan.billedFor')}</p>
              <p className="text-base font-semibold text-gray-800">
                {summary.subscription?.baselineStudentCount ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('plan.periodEnds')}</p>
              <p className="text-base font-semibold text-gray-800">
                {formatDate(summary.subscription?.currentPeriodEnd ?? null)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('plan.unpaidInvoices')}</p>
              <p className="text-base font-semibold text-gray-800">
                {summary.outstandingCount}
              </p>
            </div>
          </div>

          {extraStudents > 0 && (
            <p className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {t('plan.extraStudents', { count: extraStudents })}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <IndianRupee className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {t('noSubscription')}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{t('invoices.title')}</h2>
        </div>

        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            {t('invoices.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-2">{t('invoices.invoice')}</th>
                  <th className="px-3 py-2">{t('invoices.period')}</th>
                  <th className="px-3 py-2">{tc('field.amount')}</th>
                  <th className="px-3 py-2">{t('invoices.due')}</th>
                  <th className="px-3 py-2">{tc('field.status')}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((invoice) => (
                  <Fragment key={invoice.id}>
                  <tr>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-gray-700">
                        {invoice.invoiceNumber}
                      </span>
                      {invoice.type === 'TRUEUP' && (
                        <span
                          className="ml-1 text-[10px] text-violet-600 font-semibold"
                          title={t('invoices.addOnHint')}
                        >
                          {t('invoices.addOn')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(invoice.periodStart)} –{' '}
                      {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {rupees(invoice.totalPaise)}
                      {invoice.balancePaise > 0 &&
                        invoice.settledPaise > 0 && (
                          <p className="text-[11px] font-normal text-amber-700">
                            {t('invoices.stillDue', { amount: rupees(invoice.balancePaise) })}
                          </p>
                        )}
                      {invoice.balancePaise <= 0 &&
                        invoice.settlement &&
                        invoice.settlement.couponDiscountPaise > 0 && (
                          <p className="text-[11px] font-normal text-emerald-700">
                            {t('invoices.paidAmount', { amount: rupees(invoice.settlement.amountPaidPaise) })}
                            {invoice.settlement.couponCode &&
                              ` · ${invoice.settlement.couponCode}`}
                          </p>
                        )}
                      {invoice.amountRefundedPaise > 0 && (
                        <p className="text-[11px] font-normal text-gray-500">
                          {t('invoices.refunded', { amount: rupees(invoice.amountRefundedPaise) })}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[invoice.status]}`}
                      >
                        {t(`status.${STATUS_LABELS[invoice.status]}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => void download(invoice)}
                        disabled={downloadingId === invoice.id}
                        className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mr-3"
                      >
                        {downloadingId === invoice.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                      {invoice.balancePaise > 0 &&
                        invoice.status !== 'VOID' && (
                          <button
                            onClick={() => void pay(invoice)}
                            disabled={payingId !== null}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
                          >
                            {payingId === invoice.id ? t('invoices.opening') : t('invoices.payNow')}
                          </button>
                        )}
                    </td>
                  </tr>
                  {invoice.balancePaise > 0 && invoice.status !== 'VOID' && (
                    <tr key={`${invoice.id}-coupon`}>
                      <td colSpan={6} className="px-5 pb-3 pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={couponInput[invoice.id] ?? ''}
                            onChange={(e) =>
                              setCouponInput((current) => ({
                                ...current,
                                [invoice.id]: e.target.value.toUpperCase(),
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && void applyCoupon(invoice)
                            }
                            placeholder={t('coupon.placeholder')}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono uppercase w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => void applyCoupon(invoice)}
                            disabled={
                              checkingCoupon === invoice.id ||
                              !couponInput[invoice.id]?.trim()
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {checkingCoupon === invoice.id
                              ? t('coupon.checking')
                              : tc('action.apply')}
                          </button>
                          {appliedCoupon[invoice.id] && (
                            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                              {t.rich('coupon.applied', {
                                code: appliedCoupon[invoice.id].code,
                                amount: rupees(
                                  invoice.totalPaise -
                                    appliedCoupon[invoice.id].discountPaise,
                                ),
                                total: rupees(invoice.totalPaise),
                                b: (chunks) => <strong>{chunks}</strong>,
                              })}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
