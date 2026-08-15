'use client';

import * as React from 'react';
import useSWR from 'swr';
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

type ReportTab = 'sales' | 'payments' | 'outstanding' | 'waivers' | 'issuances' | 'stock';

const TABS: { value: ReportTab; label: string }[] = [
  { value: 'sales', label: 'Sales' },
  { value: 'payments', label: 'Payments' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'waivers', label: 'Waived Off' },
  { value: 'issuances', label: 'Borrow / Issue' },
  { value: 'stock', label: 'Stock' },
];

export default function InventoryReportsPage() {
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
      toast.error('Could not export the report');
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
      toast.error('Nothing to export yet');
    }
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Inventory"
        title="Reports"
        description="Sales and borrow reports, payments, outstanding balances, waive-offs and stock — every filter downloadable."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}><Download /> CSV</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown /> PDF</Button>
          </>
        }
        tabs={<PageTabs value={tab} onValueChange={(v) => { setTab(v as ReportTab); setPage(1); }} options={TABS} />}
      />

      <PageBody className="space-y-4">
        {summary && (
          <StatGrid columns={5}>
            <StatTile label="Sales" value={summary.salesCount} icon={<Receipt />} pigment="info" />
            <StatTile label="Sales value" value={<Money amount={summary.salesValue} symbol />} icon={<IndianRupee />} pigment="info" />
            <StatTile label="Collected" value={<Money amount={summary.collected} symbol />} icon={<Wallet />} pigment="success" />
            <StatTile label="Outstanding" value={<Money amount={summary.outstanding} symbol />} icon={<AlertTriangle />} pigment="attn" />
            <StatTile label="Low stock items" value={summary.lowStockCount} icon={<Package />} pigment={summary.lowStockCount > 0 ? 'danger' : 'neutral'} />
          </StatGrid>
        )}

        <FilterBar>
          {/* md: a date input clips its own value below ~150px. */}
          <FilterField label="From" width="md"><Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} /></FilterField>
          <FilterField label="To" width="md"><Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} /></FilterField>

          {(tab === 'sales' || tab === 'payments' || tab === 'outstanding' || tab === 'issuances') && (
            <FilterField label="Mobile" width="sm"><Input value={buyerMobile} onChange={(e) => { setBuyerMobile(e.target.value); setPage(1); }} /></FilterField>
          )}
          {(tab === 'sales' || tab === 'stock') && (
            <FilterField label="Item name" width="md"><SearchInput value={itemName} onValueChange={(v) => { setItemName(v); setPage(1); }} /></FilterField>
          )}
          {tab === 'sales' && (
            <FilterField label="Item code" width="sm"><Input value={itemCode} onChange={(e) => { setItemCode(e.target.value); setPage(1); }} /></FilterField>
          )}
          {(tab === 'sales' || tab === 'stock') && (
            <FilterField label="Category" width="md">
              <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
                <option value="">All</option>
                {categories?.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterField>
          )}
          {(tab === 'sales' || tab === 'payments') && (
            <FilterField label="Payment mode" width="md">
              <Select value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value as InventoryPaymentMode | ''); setPage(1); }}>
                <option value="">All</option>
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
              </Select>
            </FilterField>
          )}
          {tab === 'sales' && (
            <FilterField label="Status" width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="DUE">Due</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
                <option value="WAIVED">Waived</option>
              </Select>
            </FilterField>
          )}
          {tab === 'issuances' && (
            <FilterField label="Status" width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_RETURNED">Partially returned</option>
                <option value="RETURNED">Returned</option>
                <option value="OVERDUE">Overdue</option>
              </Select>
            </FilterField>
          )}
          {tab === 'stock' && (
            <FilterField label="Stock" width="sm">
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="low">Low stock only</option>
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
  if (total <= limit) return null;
  return (
    <div className="mt-3 flex justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
      <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => onPageChange(page + 1)}>Next</Button>
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
  const cols: Column<SalesReportRow>[] = [
    { key: 'receiptNumber', header: 'Receipt', accessor: (r) => r.receiptNumber, card: 'title' },
    { key: 'date', header: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString('en-IN'), card: 'meta' },
    { key: 'buyer', header: 'Buyer', accessor: (r) => r.buyerName, card: 'meta' },
    { key: 'catDisc', header: 'Cat. Discount', align: 'right', accessor: (r) => <Money amount={r.catalogDiscount} symbol />, card: 'field' },
    { key: 'ctrDisc', header: 'Counter Discount', align: 'right', accessor: (r) => <Money amount={r.counterDiscount} symbol />, card: 'field' },
    { key: 'net', header: 'Net', align: 'right', accessor: (r) => <Money amount={r.netAmount} symbol />, card: 'field' },
    { key: 'waived', header: 'Waived', align: 'right', accessor: (r) => <Money amount={r.waivedAmount} symbol />, card: 'field' },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (r) => <Money amount={r.balanceAmount} symbol tone={r.balanceAmount > 0 ? 'owing' : 'default'} />, card: 'field' },
    { key: 'status', header: 'Status', align: 'right', accessor: (r) => <StatusChip status={r.status} />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(r) => r.id} emptyMessage="No sales in this range" />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function PaymentsTable({ data, loading, page, onPageChange }: TabTableProps<InventorySalePayment & { sale?: InventorySale }>) {
  const cols: Column<InventorySalePayment & { sale?: InventorySale }>[] = [
    { key: 'date', header: 'Date', accessor: (p) => new Date(p.createdAt).toLocaleString('en-IN'), card: 'title' },
    { key: 'receipt', header: 'Receipt', accessor: (p) => p.sale?.receiptNumber ?? '—', card: 'meta' },
    { key: 'buyer', header: 'Buyer', accessor: (p) => p.sale?.buyerName ?? '—', card: 'meta' },
    { key: 'mode', header: 'Mode', accessor: (p) => PAYMENT_MODE_LABELS[p.mode], card: 'field' },
    { key: 'reference', header: 'Reference', accessor: (p) => p.reference ?? '—', card: 'field' },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (p) => <Money amount={p.amount} symbol />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(p) => p.id} emptyMessage="No payments in this range" />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function OutstandingTable({ data, loading, page, onPageChange }: TabTableProps<InventorySale>) {
  const cols: Column<InventorySale>[] = [
    { key: 'receipt', header: 'Receipt', accessor: (s) => s.receiptNumber, card: 'title' },
    { key: 'buyer', header: 'Buyer', accessor: (s) => `${s.buyerName}${s.buyerMobile ? ` · ${s.buyerMobile}` : ''}`, card: 'meta' },
    { key: 'net', header: 'Net', align: 'right', accessor: (s) => <Money amount={s.netAmount} symbol />, card: 'field' },
    { key: 'paid', header: 'Paid', align: 'right', accessor: (s) => <Money amount={s.paidAmount} symbol />, card: 'field' },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (s) => <Money amount={s.balanceAmount} symbol tone="owing" />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(s) => s.id} emptyMessage="Nothing outstanding" defaultSort={{ key: 'balance', direction: 'desc' }} />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function WaiversTable({ data, loading, page, onPageChange }: TabTableProps<InventorySaleWaiver & { sale?: InventorySale }>) {
  const cols: Column<InventorySaleWaiver & { sale?: InventorySale }>[] = [
    { key: 'date', header: 'Date', accessor: (w) => new Date(w.createdAt).toLocaleString('en-IN'), card: 'title' },
    { key: 'receipt', header: 'Receipt', accessor: (w) => w.sale?.receiptNumber ?? '—', card: 'meta' },
    { key: 'buyer', header: 'Buyer', accessor: (w) => w.sale?.buyerName ?? '—', card: 'meta' },
    { key: 'reason', header: 'Reason', accessor: (w) => w.reason, card: 'field' },
    { key: 'permittedBy', header: 'Permitted by', accessor: (w) => (w.permittedBy ? `${w.permittedBy.firstName} ${w.permittedBy.lastName}` : '—'), card: 'field' },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (w) => <Money amount={w.amount} symbol tone="owing" />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(w) => w.id} emptyMessage="No waivers in this range" />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function IssuancesTable({ data, loading, page, onPageChange }: TabTableProps<InventoryIssuance>) {
  const cols: Column<InventoryIssuance>[] = [
    { key: 'item', header: 'Item', accessor: (i) => i.itemName, card: 'title' },
    { key: 'borrower', header: 'Borrower', accessor: (i) => personName(i.borrowerType === 'STUDENT' ? i.student : i.staff), card: 'meta' },
    { key: 'qty', header: 'Qty', align: 'right', accessor: (i) => i.qty, card: 'field' },
    { key: 'outstanding', header: 'Outstanding', align: 'right', accessor: (i) => issuanceOutstanding(i), card: 'field' },
    { key: 'due', header: 'Due', accessor: (i) => i.dueDate, card: 'field' },
    { key: 'status', header: 'Status', align: 'right', accessor: (i) => <StatusChip status={i.status} />, card: 'trailing' },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(i) => i.id} isRowFlagged={(i) => i.status === 'OVERDUE'} emptyMessage="Nothing borrowed in this range" />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}

function StockTable({ data, loading, page, onPageChange }: TabTableProps<InventoryItem>) {
  const cols: Column<InventoryItem>[] = [
    { key: 'code', header: 'Code', accessor: (i) => i.code, card: 'meta' },
    { key: 'name', header: 'Item', accessor: (i) => i.name, card: 'title' },
    { key: 'category', header: 'Category', accessor: (i) => i.category?.name ?? '—', card: 'field' },
    { key: 'available', header: 'Available', align: 'right', accessor: (i) => i.availableQty, card: 'field' },
    { key: 'total', header: 'Total', align: 'right', accessor: (i) => i.totalQty, card: 'field' },
    { key: 'reorder', header: 'Reorder at', align: 'right', accessor: (i) => i.reorderLevel ?? '—', card: 'field' },
    { key: 'flag', header: '', align: 'right', card: 'trailing', accessor: (i) => (isLowStock(i) ? <StatusChip status="Low stock" pigment="danger" /> : null) },
  ];
  return (
    <>
      <DataTable columns={cols} data={data?.data} loading={loading} rowKey={(i) => i.id} isRowFlagged={(i) => isLowStock(i)} emptyMessage="No items match" />
      {data && <Pager page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />}
    </>
  );
}
