'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { BookUp, Plus, Trash2, User, Users } from 'lucide-react';

import {
  createIssuance,
  downloadIssuancesCsv,
  errorMessage,
  fetchIssuances,
  fetchInventorySettings,
  issuanceOutstanding,
  returnIssuance,
  type InventoryBorrowerType,
  type InventoryIssuance,
  type InventoryIssuanceStatus,
  type InventoryItem,
  type InventoryReturnCondition,
} from '@/lib/inventory-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody } from '@/components/ui/Panel';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField, SearchInput, SegmentedControl } from '@/components/ui/FilterBar';
import { Field, FieldGrid, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StaffPicker from '@/components/StaffPicker';
import StudentPicker from '@/components/inventory/StudentPicker';
import ItemFinder from '@/components/inventory/ItemFinder';

const PAGE_SIZE = 20;

export default function IssuancesPage() {
  const t = useTranslations('inventory.issuances');
  const tc = useTranslations('common');
  const ti = useTranslations('inventory');
  const [status, setStatus] = React.useState<InventoryIssuanceStatus | ''>('');
  const [itemName, setItemName] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [returning, setReturning] = React.useState<InventoryIssuance | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const query = { status: status || undefined, itemName: itemName || undefined, mobile: mobile || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading, mutate } = useSWR(`/inventory/issuances?${JSON.stringify(query)}`, () => fetchIssuances(query));
  const { data: settings } = useSWR('/inventory/settings', fetchInventorySettings);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadIssuancesCsv(query, `inventory-issuances_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<InventoryIssuance>[] = [
    { key: 'item', header: t('col.item'), accessor: (r) => r.itemName, card: 'title' },
    {
      key: 'borrower',
      header: t('col.borrower'),
      accessor: (r) => (r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user) ? `${(r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user)!.firstName} ${(r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user)!.lastName}` : '—',
      card: 'meta',
    },
    { key: 'qty', header: t('col.qty'), align: 'right', accessor: (r) => r.qty, card: 'field' },
    { key: 'outstanding', header: t('col.outstanding'), align: 'right', accessor: (r) => issuanceOutstanding(r), card: 'field' },
    { key: 'due', header: t('col.due'), accessor: (r) => r.dueDate, card: 'field' },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (r) => <StatusChip status={r.status} label={ti(`issuanceStatus.${r.status}`)} />, card: 'trailing' },
    {
      key: 'actions',
      header: tc('action.actions'),
      align: 'right',
      // Returning stock is the only action here — hiding it on mobile meant
      // no phone could record one.
      card: 'trailing',
      accessor: (r) => (
        <RowActionsMenu
          actions={[r.status !== 'RETURNED' && { label: t('return'), onSelect: () => setReturning(r) }]}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={t('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>{exporting ? t('exporting') : t('exportCsv')}</Button>
            <Button onClick={() => setIssueOpen(true)}><Plus /> {t('issueItem')}</Button>
          </>
        }
      />

      <PageBody>
        <FilterBar>
          <SearchInput value={itemName} onValueChange={(v) => { setItemName(v); setPage(1); }} placeholder={t('itemNamePlaceholder')} />
          <FilterField label={tc('field.status')} width="sm">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as InventoryIssuanceStatus | ''); setPage(1); }}>
              <option value="">{tc('field.all')}</option>
              <option value="ISSUED">{ti('issuanceStatus.ISSUED')}</option>
              <option value="PARTIALLY_RETURNED">{ti('issuanceStatus.PARTIALLY_RETURNED')}</option>
              <option value="RETURNED">{ti('issuanceStatus.RETURNED')}</option>
              <option value="OVERDUE">{ti('issuanceStatus.OVERDUE')}</option>
            </Select>
          </FilterField>
          <FilterField label={tc('field.mobile')} width="sm">
            <Input value={mobile} onChange={(e) => { setMobile(e.target.value); setPage(1); }} />
          </FilterField>
        </FilterBar>

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          isRowFlagged={(r) => r.status === 'OVERDUE'}
          emptyMessage={t('empty')}
          toolbar={
            <>
              <BookUp className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('issuances')}</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tc('action.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tc('action.next')}</Button>
          </div>
        )}
      </PageBody>

      {issueOpen && (
        <IssueDialog
          defaultLoanDays={settings?.defaultLoanDays ?? 7}
          maxLoanDays={settings?.maxLoanDays ?? 30}
          onClose={() => setIssueOpen(false)}
          onSaved={() => {
            setIssueOpen(false);
            mutate();
          }}
        />
      )}

      {returning && (
        <ReturnDialog
          issuance={returning}
          onClose={() => setReturning(null)}
          onSaved={() => {
            setReturning(null);
            mutate();
          }}
        />
      )}
    </PageShell>
  );
}

function IssueDialog({
  defaultLoanDays,
  maxLoanDays,
  onClose,
  onSaved,
}: {
  defaultLoanDays: number;
  maxLoanDays: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('inventory.issue');
  const tc = useTranslations('common');
  const [item, setItem] = React.useState<InventoryItem | null>(null);
  const [qty, setQty] = React.useState('1');
  const [borrowerType, setBorrowerType] = React.useState<InventoryBorrowerType>('STUDENT');
  const [studentId, setStudentId] = React.useState<number | null>(null);
  const [staffId, setStaffId] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxLoanDays);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) { toast.error(t('itemFirst')); return; }
    if (borrowerType === 'STUDENT' && !studentId) { toast.error(t('selectStudent')); return; }
    if (borrowerType === 'STAFF' && !staffId) { toast.error(t('selectStaff')); return; }
    setSaving(true);
    try {
      await createIssuance({
        itemId: item.id,
        qty: Number(qty),
        borrowerType,
        studentId: borrowerType === 'STUDENT' ? studentId! : undefined,
        staffId: borrowerType === 'STAFF' ? staffId! : undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      });
      toast.success(t('issued'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('issueFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('title')}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            {item ? (
              <Panel>
                <PanelBody className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{item.name}</p>
                    <p className="text-[12px] text-ink-muted">{item.code} · {t('available', { count: item.availableQty })}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItem(null)}><Trash2 className="size-3.5" /></Button>
                </PanelBody>
              </Panel>
            ) : (
              // The same finder the sell counter uses: scan or type a code, or
              // — when the item carries no readable label — pick a category and
              // search the name. Unmounts once an item is chosen, which also
              // stops the USB/Bluetooth wedge inside it from overwriting it.
              <ItemFinder onPick={(found) => setItem(found)} submitLabel={t('find')} scanLabel={t('scanItem')} />
            )}

            <Field label={t('qty')} required>
              <Input type="number" min="1" max={item?.availableQty} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </Field>

            <SegmentedControl
              value={borrowerType}
              onValueChange={(v) => setBorrowerType(v as InventoryBorrowerType)}
              options={[{ value: 'STUDENT', label: tc('field.student'), icon: <User /> }, { value: 'STAFF', label: t('staff'), icon: <Users /> }]}
            />
            {borrowerType === 'STUDENT' ? (
              <StudentPicker value={studentId} onChange={(id) => setStudentId(id)} />
            ) : (
              <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="" />
            )}

            <Field label={t('dueDate')} hint={t('dueDateHint', { defaultDays: defaultLoanDays, maxDays: maxLoanDays })}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} max={maxDate.toISOString().slice(0, 10)} />
            </Field>
            <Field label={t('notes')}>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc('action.cancel')}</Button>
            <Button type="submit" disabled={saving || !item}>{saving ? tc('action.saving') : t('submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReturnLine {
  condition: InventoryReturnCondition;
  qty: string;
}

function ReturnDialog({
  issuance,
  onClose,
  onSaved,
}: {
  issuance: InventoryIssuance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('inventory.return');
  const tc = useTranslations('common');
  const outstanding = issuanceOutstanding(issuance);
  const [lines, setLines] = React.useState<ReturnLine[]>([{ condition: 'GOOD', qty: String(outstanding) }]);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const totalQty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const remaining = outstanding - totalQty;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQty <= 0 || totalQty > outstanding) { toast.error(t('qtyRange', { max: outstanding })); return; }
    setSaving(true);
    try {
      await returnIssuance(issuance.id, {
        returns: lines.filter((l) => Number(l.qty) > 0).map((l) => ({ condition: l.condition, qty: Number(l.qty) })),
        note: note || undefined,
      });
      toast.success(t('recorded'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('recordFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('title', { name: issuance.itemName })}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">{t('summary', { outstanding, remaining })}</p>
            {lines.map((line, i) => (
              <FieldGrid key={i} columns={3}>
                <Field label={t('condition')}>
                  <Select value={line.condition} onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, condition: e.target.value as InventoryReturnCondition } : l))}>
                    <option value="GOOD">{t('good')}</option>
                    <option value="DAMAGED">{t('damaged')}</option>
                    <option value="LOST">{t('lost')}</option>
                  </Select>
                </Field>
                <Field label={t('qty')}>
                  <Input type="number" min="0" value={line.qty} onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, qty: e.target.value } : l))} />
                </Field>
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="self-end" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </FieldGrid>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { condition: 'GOOD', qty: '' }])}>
              <Plus className="size-3.5" /> {t('addCondition')}
            </Button>
            <Field label={t('note')}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
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
