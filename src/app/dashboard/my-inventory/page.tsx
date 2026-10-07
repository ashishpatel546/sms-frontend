'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import { Toaster } from 'react-hot-toast';
import { ArrowLeftRight, Boxes, Receipt, ShoppingBag } from 'lucide-react';

import FeatureGate from '@/components/dashboard/FeatureGate';
import {
  fetchMyIssuances,
  fetchMySales,
  issuanceOutstanding,
  type InventoryIssuance,
  type InventorySale,
} from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/FilterBar';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

const PAGE_SIZE = 10;

/**
 * The store from the buyer's side. A parent opens this to see what their
 * children bought and borrowed; a teacher, their own. Everything here is
 * read-only — questions, not another counter.
 */
export default function MyInventoryPage() {
  const t = useTranslations('inventory.my');
  const tc = useTranslations('common');
  const ti = useTranslations('inventory');
  const locale = useLocale() as Locale;
  const [salesPage, setSalesPage] = React.useState(1);
  const [issuancesPage, setIssuancesPage] = React.useState(1);

  const { data: sales, isLoading: salesLoading } = useSWR(
    `/inventory/my/sales?${salesPage}`,
    () => fetchMySales(salesPage, PAGE_SIZE),
  );
  const { data: issuances, isLoading: issuancesLoading } = useSWR(
    `/inventory/my/issuances?${issuancesPage}`,
    () => fetchMyIssuances(issuancesPage, PAGE_SIZE),
  );

  const saleColumns: Column<InventorySale>[] = [
    {
      key: 'receipt',
      header: t('col.receipt'),
      accessor: (r) => <span className="tabular font-mono text-[12.5px]">{r.receiptNumber}</span>,
      card: 'title',
    },
    {
      key: 'date',
      header: tc('field.date'),
      accessor: (r) => new Date(r.createdAt).toLocaleDateString(INTL_LOCALE[locale]),
      card: 'meta',
    },
    {
      key: 'items',
      header: t('col.items'),
      accessor: (r) => {
        const names = (r.lines ?? []).map((l) => `${l.itemName} × ${l.qty}`);
        return (
          <span className="block max-w-64 truncate" title={names.join(', ')}>
            {names.join(', ') || '—'}
          </span>
        );
      },
      card: 'field',
    },
    { key: 'net', header: t('col.net'), align: 'right', accessor: (r) => <Money amount={r.netAmount} symbol />, card: 'field' },
    {
      key: 'balance',
      header: t('col.balance'),
      align: 'right',
      accessor: (r) => <Money amount={r.balanceAmount} symbol tone={r.balanceAmount > 0 ? 'owing' : 'default'} />,
      card: 'field',
    },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (r) => <StatusChip status={r.status} label={ti(`saleStatus.${r.status}`)} />, card: 'trailing' },
  ];

  const issuanceColumns: Column<InventoryIssuance>[] = [
    { key: 'item', header: t('col.item'), accessor: (r) => r.itemName, card: 'title' },
    { key: 'qty', header: t('col.qty'), align: 'right', accessor: (r) => r.qty, card: 'field' },
    {
      key: 'outstanding',
      header: t('col.toReturn'),
      align: 'right',
      accessor: (r) => issuanceOutstanding(r),
      card: 'field',
    },
    {
      key: 'due',
      header: t('col.due'),
      accessor: (r) => {
        const overdue = r.status === 'OVERDUE';
        return (
          <span className={overdue ? 'font-semibold text-accent-danger-deep' : undefined}>
            {new Date(r.dueDate).toLocaleDateString(INTL_LOCALE[locale])}
          </span>
        );
      },
      card: 'meta',
    },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (r) => <StatusChip status={r.status} label={ti(`issuanceStatus.${r.status}`)} />, card: 'trailing' },
  ];

  return (
    <FeatureGate
      flag="inventory_management"
      title={t('title')}
      icon={<ShoppingBag />}
      description={t('gateDescription')}
    >
      <PageShell>
        <Toaster position="top-center" />
        <PageHeader
          section={t('section')}
          title={t('title')}
          description={t('description')}
        />

        <PageBody className="space-y-4">
          <DataTable
            columns={saleColumns}
            data={sales?.data}
            loading={salesLoading}
            rowKey={(r) => r.id}
            emptyMessage={t('noPurchases')}
            toolbar={
              <>
                <Receipt className="size-4 text-ink-faint" />
                <span className="font-display text-[15px] font-semibold text-ink">{t('purchases')}</span>
                {sales && <TableCount>{sales.total}</TableCount>}
              </>
            }
            footer={
              sales && sales.total > PAGE_SIZE ? (
                <Pagination
                  page={salesPage}
                  pageCount={Math.ceil(sales.total / PAGE_SIZE)}
                  onPageChange={setSalesPage}
                  total={sales.total}
                  pageSize={PAGE_SIZE}
                />
              ) : undefined
            }
          />

          <DataTable
            columns={issuanceColumns}
            data={issuances?.data}
            loading={issuancesLoading}
            rowKey={(r) => r.id}
            isRowFlagged={(r) => r.status === 'OVERDUE'}
            emptyMessage={t('noBorrowed')}
            toolbar={
              <>
                <ArrowLeftRight className="size-4 text-ink-faint" />
                <span className="font-display text-[15px] font-semibold text-ink">{t('borrowed')}</span>
                {issuances && <TableCount>{issuances.total}</TableCount>}
              </>
            }
            footer={
              issuances && issuances.total > PAGE_SIZE ? (
                <Pagination
                  page={issuancesPage}
                  pageCount={Math.ceil(issuances.total / PAGE_SIZE)}
                  onPageChange={setIssuancesPage}
                  total={issuances.total}
                  pageSize={PAGE_SIZE}
                />
              ) : undefined
            }
          />

          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
            <Boxes className="size-3.5" aria-hidden />
            {t('footnote')}
          </p>
        </PageBody>
      </PageShell>
    </FeatureGate>
  );
}
