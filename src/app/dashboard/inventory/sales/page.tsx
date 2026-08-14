'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { Download, Receipt } from 'lucide-react';

import { downloadSalesCsv, fetchSales, type InventorySale, type InventorySaleStatus } from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField, SearchInput } from '@/components/ui/FilterBar';
import { Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';

const PAGE_SIZE = 20;
const STATUSES: InventorySaleStatus[] = ['DUE', 'PARTIAL', 'PAID', 'WAIVED'];

export default function SalesRegisterPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<InventorySaleStatus | ''>('');
  const [buyerMobile, setBuyerMobile] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

  const query = {
    search: search || undefined,
    status: status || undefined,
    buyerMobile: buyerMobile || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading } = useSWR(`/inventory/sales?${JSON.stringify(query)}`, () => fetchSales(query));

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadSalesCsv(query, `inventory-sales_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast.error('Could not export the register');
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<InventorySale>[] = [
    { key: 'receiptNumber', header: 'Receipt', accessor: (r) => <span className="tabular font-mono text-[12.5px]">{r.receiptNumber}</span>, card: 'title' },
    { key: 'date', header: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString('en-IN'), card: 'meta' },
    { key: 'buyer', header: 'Buyer', accessor: (r) => r.buyerName, card: 'meta' },
    { key: 'net', header: 'Net', align: 'right', accessor: (r) => <Money amount={r.netAmount} symbol />, card: 'field' },
    { key: 'paid', header: 'Paid', align: 'right', accessor: (r) => <Money amount={r.paidAmount} symbol />, card: 'field' },
    { key: 'balance', header: 'Balance', align: 'right', accessor: (r) => <Money amount={r.balanceAmount} symbol tone={r.balanceAmount > 0 ? 'owing' : 'default'} />, card: 'field' },
    { key: 'status', header: 'Status', align: 'right', accessor: (r) => <StatusChip status={r.status} />, card: 'trailing' },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Inventory"
        title="Sales"
        description="Every counter sale, with running balance."
        actions={<Button variant="outline" onClick={exportCsv} disabled={exporting}><Download /> {exporting ? 'Exporting…' : 'Export CSV'}</Button>}
      />

      <PageBody>
        <FilterBar>
          <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Receipt no. or buyer name…" />
          <FilterField label="Status" width="sm">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as InventorySaleStatus | ''); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Mobile" width="sm">
            <Input value={buyerMobile} onChange={(e) => { setBuyerMobile(e.target.value); setPage(1); }} />
          </FilterField>
          {/* md, not sm: a date input needs ~150px for its own text — at
              112px the value clips inside the box even on a laptop. */}
          <FilterField label="From" width="md">
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </FilterField>
          <FilterField label="To" width="md">
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </FilterField>
        </FilterBar>

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/inventory/sales/${r.id}`)}
          emptyMessage="No sales recorded yet"
          toolbar={
            <>
              <Receipt className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">Register</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </PageBody>
    </PageShell>
  );
}
