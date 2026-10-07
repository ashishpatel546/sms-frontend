'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { AlertTriangle, Download, FileDown, IndianRupee, Package, Receipt, Wallet } from 'lucide-react';

import {
  downloadReportCsv,
  fetchCategories,
  fetchInventorySummary,
  fetchIssuancesReport,
  fetchOutstandingReport,
  fetchPaymentsReport,
  fetchSalesReport,
  fetchStockReport,
  fetchWaiversReport,
  isLowStock,
  issuanceOutstanding,
  personName,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  type InventoryIssuance,
  type InventoryItem,
  type InventoryPaymentMode,
  type InventorySale,
  type InventorySalePayment,
  type InventorySaleWaiver,
  type Paginated,
  type ReportQuery,
  type SalesReportRow,
} from '@/lib/inventory-api';
import { buildInventoryReportPdf } from '@/lib/inventory-report-pdf';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { Column, DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, PageTabs, SearchInput } from '@/components/ui/FilterBar';
import { Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

type ReportTab = 'sales' | 'payments' | 'outstanding' | 'waivers' | 'issuances' | 'stock';

const TABS: ReportTab[] = ['sales', 'payments', 'outstanding', 'waivers', 'issuances', 'stock'];

export default function InventoryReportsPage() {
  const t = useTranslations('inventory.reports');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const [tab, setTab] = React.useState<ReportTab>('sales');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [buyerMobile, setBuyerMobile] = React.useState('');
  const [itemName, setItemName] = React.useState('');
  const [itemCode, setItemCode] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<number | ''>('');
  const [paymentMode, setPaymentMode] = React.useState<InventoryPaymentMode | ''>('');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

  const { data: categories } = useSWR('/inventory/categories', fetchCategories);

  const baseQuery: ReportQuery = {
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    buyerMobile: buyerMobile || undefined,
    itemName: itemName || undefined,
    itemCode: itemCode || undefined,
    categoryId: categoryId || undefined,
    paymentMode: paymentMode || undefined,
    status: status || undefined,
    mobile: buyerMobile || undefined,
    lowStockOnly: tab === 'stock' && status === 'low' ? true : undefined,
    page,
    limit: 20,
  };

  const { data: summary } = useSWR(
    `/inventory/reports/summary?${JSON.stringify({ fromDate, toDate })}`,
    () => fetchInventorySummary({ fromDate: fromDate || undefined, toDate: toDate || undefined }),
  );

  const salesQ = useSWR(tab === 'sales' ? ['sales', baseQuery] : null, () => fetchSalesReport(baseQuery));
  const paymentsQ = useSWR(tab === 'payments' ? ['payments', baseQuery] : null, () => fetchPaymentsReport(baseQuery));
  const outstandingQ = useSWR(tab === 'outstanding' ? ['outstanding', baseQuery] : null, () => fetchOutstandingReport(baseQuery));
  const waiversQ = useSWR(tab === 'waivers' ? ['waivers', baseQuery] : null, () => fetchWaiversReport(baseQuery));
  const issuancesQ = useSWR(tab === 'issuances' ? ['issuances', baseQuery] : null, () => fetchIssuancesReport(baseQuery));
  const stockQ = useSWR(tab === 'stock' ? ['stock', baseQuery] : null, () => fetchStockReport(baseQuery));

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadReportCsv(tab, baseQuery, `inventory-${tab}-report_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    const dateRange = fromDate || toDate ? `${fromDate || 'start'} to ${toDate || 'today'}` : 'All dates';
    if (tab === 'sales' && salesQ.data) {
      buildInventoryReportPdf(
        'Inventory Sales Report',
        dateRange,
        ['Receipt', 'Date', 'Buyer', 'Gross', 'Cat. Disc', 'Ctr. Disc', 'Net', 'Paid', 'Waived', 'Balance', 'Status'],
        salesQ.data.data.map((r) => [r.receiptNumber, new Date(r.createdAt).toLocaleDateString('en-IN'), r.buyerName, r.grossAmount, r.catalogDiscount, r.counterDiscount, r.netAmount, r.paidAmount, r.waivedAmount, r.balanceAmount, r.status]),
        `inventory-sales-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else if (tab === 'payments' && paymentsQ.data) {
      buildInventoryReportPdf(
        'Inventory Payments Collected',
        dateRange,
        ['Date', 'Receipt', 'Buyer', 'Amount', 'Mode', 'Reference'],
        paymentsQ.data.data.map((p) => [new Date(p.createdAt).toLocaleString('en-IN'), p.sale?.receiptNumber ?? '', p.sale?.buyerName ?? '', p.amount, PAYMENT_MODE_LABELS[p.mode], p.reference ?? '']),
        `inventory-payments-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else if (tab === 'outstanding' && outstandingQ.data) {
      buildInventoryReportPdf(
        'Inventory Outstanding Balances',
        dateRange,
        ['Receipt', 'Date', 'Buyer', 'Mobile', 'Net', 'Paid', 'Balance', 'Status'],
        outstandingQ.data.data.map((s) => [s.receiptNumber, new Date(s.createdAt).toLocaleDateString('en-IN'), s.buyerName, s.buyerMobile ?? '', s.netAmount, s.paidAmount, s.balanceAmount, s.status]),
        `inventory-outstanding-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else if (tab === 'waivers' && waiversQ.data) {
      buildInventoryReportPdf(
        'Inventory Waived-Off Report',
        dateRange,
        ['Date', 'Receipt', 'Buyer', 'Amount', 'Reason', 'Permitted By'],
        waiversQ.data.data.map((w) => [new Date(w.createdAt).toLocaleString('en-IN'), w.sale?.receiptNumber ?? '', w.sale?.buyerName ?? '', w.amount, w.reason, w.permittedBy ? `${w.permittedBy.firstName} ${w.permittedBy.lastName}` : '']),
        `inventory-waivers-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else if (tab === 'issuances' && issuancesQ.data) {
      buildInventoryReportPdf(
        'Inventory Borrow / Issue Report',
        dateRange,
        ['Item', 'Borrower', 'Qty', 'Outstanding', 'Issue date', 'Due date', 'Status'],
        issuancesQ.data.data.map((i) => [i.itemName, personName(i.borrowerType === 'STUDENT' ? i.student : i.staff), i.qty, issuanceOutstanding(i), new Date(i.issueDate).toLocaleDateString('en-IN'), i.dueDate, i.status]),
        `inventory-issuances-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else if (tab === 'stock' && stockQ.data) {
      buildInventoryReportPdf(
        'Inventory Stock Report',
        dateRange,
        ['Code', 'Name', 'Category', 'Available', 'Total', 'Reorder Level', 'Selling Price'],
        stockQ.data.data.map((i) => [i.code, i.name, i.category?.name ?? '', i.availableQty, i.totalQty, i.reorderLevel ?? '', i.sellingPrice]),
        `inventory-stock-report_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } else {
      toast.error(t('nothingToExport'));
    }
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={t('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}><Download /> CSV</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown /> PDF</Button>
          </>
        }
        tabs={<PageTabs value={tab} onValueChange={(v) => { setTab(v as ReportTab); setPage(1); }} options={TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))} />}
      />

      <PageBody className="space-y-4">
        {summary && (
          <StatGrid columns={5}>
            <StatTile label={t('stat.sales')} value={summary.salesCount} icon={<Receipt />} pigment="info" />
            <StatTile label={t('stat.salesValue')} value={<Money amount={summary.salesValue} symbol />} icon={<IndianRupee />} pigment="info" />
            <StatTile label={t('stat.collected')} value={<Money amount={summary.collected} symbol />} icon={<Wallet />} pigment="success" />
            <StatTile label={t('stat.outstanding')} value={<Money amount={summary.outstanding} symbol />} icon={<AlertTriangle />} pigment="attn" />
            <StatTile label={t('stat.lowStock')} value={summary.lowStockCount} icon={<Package />} pigment={summary.lowStockCount > 0 ? 'danger' : 'neutral'} />
          </StatGrid>
        )}

        <FilterBar>
          {/* md: a date input clips its own value below ~150px. */}
          <FilterField label={tc('field.from')} width="md"><Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} /></FilterField>
          <FilterField label={tc('field.to')} width="md"><Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} /></FilterField>

          {(tab === 'sales' || tab === 'payments' || tab === 'outstanding' || tab === 'issuances') && (
            <FilterField label={tc('field.mobile')} width="sm"><Input value={buyerMobile} onChange={(e) => { setBuyerMobile(e.target.value); setPage(1); }} /></FilterField>
          )}
          {(tab === 'sales' || tab === 'stock') && (
            <FilterField label={t('filter.itemName')} width="md"><SearchInput value={itemName} onValueChange={(v) => { setItemName(v); setPage(1); }} /></FilterField>
          )}
          {tab === 'sales' && (
            <FilterField label={t('filter.itemCode')} width="sm"><Input value={itemCode} onChange={(e) => { setItemCode(e.target.value); setPage(1); }} /></FilterField>
          )}
          {(tab === 'sales' || tab === 'stock') && (
            <FilterField label={t('filter.category')} width="md">
              <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
                <option value="">{tc('field.all')}</option>
                {categories?.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterField>
          )}
          {(tab === 'sales' || tab === 'payments') && (
            <FilterField label={t('filter.paymentMode')} width="md">
              <Select value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value as InventoryPaymentMode | ''); setPage(1); }}>
                <option value="">{tc('field.all')}</option>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{ti(`paymentMode.${m}`)}</option>)}
              </Select>
            </FilterField>
          )}
          {tab === 'sales' && (
            <FilterField label={tc('field.status')} width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{tc('field.all')}</option>
                <option value="DUE">{ti('saleStatus.DUE')}</option>
                <option value="PARTIAL">{ti('saleStatus.PARTIAL')}</option>
                <option value="PAID">{ti('saleStatus.PAID')}</option>
                <option value="WAIVED">{ti('saleStatus.WAIVED')}</option>
              </Select>
            </FilterField>
          )}
          {tab === 'issuances' && (
            <FilterField label={tc('field.status')} width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{tc('field.all')}</option>
                <option value="ISSUED">{ti('issuanceStatus.ISSUED')}</option>
                <option value="PARTIALLY_RETURNED">{ti('issuanceStatus.PARTIALLY_RETURNED')}</option>
                <option value="RETURNED">{ti('issuanceStatus.RETURNED')}</option>
                <option value="OVERDUE">{ti('issuanceStatus.OVERDUE')}</option>
              </Select>
            </FilterField>
          )}
          {tab === 'stock' && (
            <FilterField label={t('filter.stock')} width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{tc('field.all')}</option>
                <option value="low">{t('filter.lowStockOnly')}</option>
              </Select>
            </FilterField>
          )}
        </FilterBar>

        {tab === 'sales' && <SalesTable data={salesQ.data} loading={salesQ.isLoading} page={page} onPageChange={setPage} />}
        {tab === 'payments' && <PaymentsTable data={paymentsQ.data} loading={paymentsQ.isLoading} page={page} onPageChange={setPage} />}
        {tab === 'outstanding' && <OutstandingTable data={outstandingQ.data} loading={outstandingQ.isLoading} page={page} onPageChange={setPage} />}
        {tab === 'waivers' && <WaiversTable data={waiversQ.data} loading={waiversQ.isLoading} page={page} onPageChange={setPage} />}
        {tab === 'issuances' && <IssuancesTable data={issuancesQ.data} loading={issuancesQ.isLoading} page={page} onPageChange={setPage} />}
        {tab === 'stock' && <StockTable data={stockQ.data} loading={stockQ.isLoading} page={page} onPageChange={setPage} />}
      </PageBody>
    </PageShell>
  );
}

/* ── Per-tab tables ───────────────────────────────────────────────────── */

function Pager({ page, total, limit, onPageChange }: { page: number; total: number; limit: number; onPageChange: (p: number) => void }) {
  const tc = useTranslations('common');
  if (total <= limit) return null;
  return (
    <div className="mt-3 flex justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{tc('action.previous')}</Button>
      <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => onPageChange(page + 1)}>{tc('action.next')}</Button>
    </div>
  );
}

interface TabTableProps<T> {
  data: Paginated<T> | undefined;
  loading: boolean;
  page: number;
  onPageChange: (p: number) => void;
}

function SalesTable({ data, loading, page, onPageChange }: TabTableProps<SalesReportRow>) {
  const t = useTranslations('inventory.reports');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const cols: Column<SalesReportRow>[] = [
    { key: 'receiptNumber', header: t('col.receipt'), accessor: (r) => r.receiptNumber, card: 'title' },
    { key: 'date', header: tc('field.date'), accessor: (r) => new Date(r.createdAt).toLocaleDateString(INTL_LOCALE[locale]), card: 'meta' },
    { key: 'buyer', header: t('col.buyer'), accessor: (r) => r.buyerName, card: 'meta' },
    { key: 'catDisc', header: t('col.catDiscount'), align: 'right', accessor: (r) => <Money amount={r.catalogDiscount} symbol />, card: 'field' },
    { key: 'ctrDisc', header: t('col.counterDiscount'), align: 'right', accessor: (r) => <Money amount={r.counterDiscount} symbol />, card: 'field' },
    { key: 'net', header: t('col.net'), align: 'right', accessor: (r) => <Money amount={r.netAmount} symbol />, card: 'field' },
    { key: 'waived', header: t('col.waived'), align: 'right', accessor: (r) => <Money amount={r.waivedAmount} symbol />, card: 'field' },
    { key: 'balance', header: t('col.balance'), align: 'right', accessor: (r) => <Money amount={r.balanceAmount} symbol tone={r.balanceAmount > 0 ? 'owing' : 'default'} />, card: 'field' },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (r) => <StatusChip status={r.status} label={ti(`saleStatus.${r.status}`)} />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(r) => r.id} emptyMessage={t('empty.sales')} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function PaymentsTable({ data, loading, page, onPageChange }: TabTableProps<InventorySalePayment & { sale?: InventorySale }>) {
  const t = useTranslations('inventory.reports');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const cols: Column<InventorySalePayment & { sale?: InventorySale }>[] = [
    { key: 'date', header: tc('field.date'), accessor: (p) => new Date(p.createdAt).toLocaleString(INTL_LOCALE[locale]), card: 'title' },
    { key: 'receipt', header: t('col.receipt'), accessor: (p) => p.sale?.receiptNumber ?? '—', card: 'meta' },
    { key: 'buyer', header: t('col.buyer'), accessor: (p) => p.sale?.buyerName ?? '—', card: 'meta' },
    { key: 'mode', header: t('col.mode'), accessor: (p) => ti(`paymentMode.${p.mode}`), card: 'field' },
    { key: 'reference', header: t('col.reference'), accessor: (p) => p.reference ?? '—', card: 'field' },
    { key: 'amount', header: tc('field.amount'), align: 'right', accessor: (p) => <Money amount={p.amount} symbol />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(p) => p.id} emptyMessage={t('empty.payments')} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function OutstandingTable({ data, loading, page, onPageChange }: TabTableProps<InventorySale>) {
  const t = useTranslations('inventory.reports');
  const cols: Column<InventorySale>[] = [
    { key: 'receipt', header: t('col.receipt'), accessor: (s) => s.receiptNumber, card: 'title' },
    { key: 'buyer', header: t('col.buyer'), accessor: (s) => `${s.buyerName}${s.buyerMobile ? ` · ${s.buyerMobile}` : ''}`, card: 'meta' },
    { key: 'net', header: t('col.net'), align: 'right', accessor: (s) => <Money amount={s.netAmount} symbol />, card: 'field' },
    { key: 'paid', header: t('col.paid'), align: 'right', accessor: (s) => <Money amount={s.paidAmount} symbol />, card: 'field' },
    { key: 'balance', header: t('col.balance'), align: 'right', accessor: (s) => <Money amount={s.balanceAmount} symbol tone="owing" />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(s) => s.id} emptyMessage={t('empty.outstanding')} defaultSort={{ key: 'balance', direction: 'desc' }} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function WaiversTable({ data, loading, page, onPageChange }: TabTableProps<InventorySaleWaiver & { sale?: InventorySale }>) {
  const t = useTranslations('inventory.reports');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const cols: Column<InventorySaleWaiver & { sale?: InventorySale }>[] = [
    { key: 'date', header: tc('field.date'), accessor: (w) => new Date(w.createdAt).toLocaleString(INTL_LOCALE[locale]), card: 'title' },
    { key: 'receipt', header: t('col.receipt'), accessor: (w) => w.sale?.receiptNumber ?? '—', card: 'meta' },
    { key: 'buyer', header: t('col.buyer'), accessor: (w) => w.sale?.buyerName ?? '—', card: 'meta' },
    { key: 'reason', header: t('col.reason'), accessor: (w) => w.reason, card: 'field' },
    { key: 'permittedBy', header: t('col.permittedBy'), accessor: (w) => (w.permittedBy ? `${w.permittedBy.firstName} ${w.permittedBy.lastName}` : '—'), card: 'field' },
    { key: 'amount', header: tc('field.amount'), align: 'right', accessor: (w) => <Money amount={w.amount} symbol tone="owing" />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(w) => w.id} emptyMessage={t('empty.waivers')} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function IssuancesTable({ data, loading, page, onPageChange }: TabTableProps<InventoryIssuance>) {
  const t = useTranslations('inventory.reports');
  const ti = useTranslations('inventory');
  const tc = useTranslations('common');
  const cols: Column<InventoryIssuance>[] = [
    { key: 'item', header: t('col.item'), accessor: (i) => i.itemName, card: 'title' },
    { key: 'borrower', header: t('col.borrower'), accessor: (i) => personName(i.borrowerType === 'STUDENT' ? i.student : i.staff), card: 'meta' },
    { key: 'qty', header: t('col.qty'), align: 'right', accessor: (i) => i.qty, card: 'field' },
    { key: 'outstanding', header: t('col.outstanding'), align: 'right', accessor: (i) => issuanceOutstanding(i), card: 'field' },
    { key: 'due', header: t('col.due'), accessor: (i) => i.dueDate, card: 'field' },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (i) => <StatusChip status={i.status} label={ti(`issuanceStatus.${i.status}`)} />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(i) => i.id} isRowFlagged={(i) => i.status === 'OVERDUE'} emptyMessage={t('empty.issuances')} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function StockTable({ data, loading, page, onPageChange }: TabTableProps<InventoryItem>) {
  const t = useTranslations('inventory.reports');
  const tc = useTranslations('common');
  const cols: Column<InventoryItem>[] = [
    { key: 'code', header: t('col.code'), accessor: (i) => i.code, card: 'meta' },
    { key: 'name', header: t('col.item'), accessor: (i) => i.name, card: 'title' },
    { key: 'category', header: t('col.category'), accessor: (i) => i.category?.name ?? '—', card: 'field' },
    { key: 'available', header: t('col.available'), align: 'right', accessor: (i) => i.availableQty, card: 'field' },
    { key: 'total', header: tc('field.total'), align: 'right', accessor: (i) => i.totalQty, card: 'field' },
    { key: 'reorder', header: t('col.reorderAt'), align: 'right', accessor: (i) => i.reorderLevel ?? '—', card: 'field' },
    { key: 'flag', header: '', align: 'right', card: 'trailing', accessor: (i) => (isLowStock(i) ? <StatusChip status="Low stock" label={t('lowStock')} pigment="danger" /> : null) },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(i) => i.id} isRowFlagged={(i) => isLowStock(i)} emptyMessage={t('empty.stock')} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}
