'use client';

import * as React from 'react';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { BookUp, Plus, ScanLine, Trash2, User, Users } from 'lucide-react';

import {
  createIssuance,
  downloadIssuancesCsv,
  errorMessage,
  fetchIssuances,
  fetchInventorySettings,
  issuanceOutstanding,
  lookupItem,
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
import StableScanner from '@/components/inventory/StableScanner';
import { useKeyboardWedge } from '@/components/inventory/useKeyboardWedge';

const PAGE_SIZE = 20;

export default function IssuancesPage() {
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
      toast.error('Could not export');
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<InventoryIssuance>[] = [
    { key: 'item', header: 'Item', accessor: (r) => r.itemName, card: 'title' },
    {
      key: 'borrower',
      header: 'Borrower',
      accessor: (r) => (r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user) ? `${(r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user)!.firstName} ${(r.borrowerType === 'STUDENT' ? r.student?.user : r.staff?.user)!.lastName}` : '—',
      card: 'meta',
    },
    { key: 'qty', header: 'Qty', align: 'right', accessor: (r) => r.qty, card: 'field' },
    { key: 'outstanding', header: 'Outstanding', align: 'right', accessor: (r) => issuanceOutstanding(r), card: 'field' },
    { key: 'due', header: 'Due', accessor: (r) => r.dueDate, card: 'field' },
    { key: 'status', header: 'Status', align: 'right', accessor: (r) => <StatusChip status={r.status} />, card: 'trailing' },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      // Returning stock is the only action here — hiding it on mobile meant
      // no phone could record one.
      card: 'trailing',
      accessor: (r) => (
        <RowActionsMenu
          actions={[r.status !== 'RETURNED' && { label: 'Return', onSelect: () => setReturning(r) }]}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Inventory"
        title="Issue / Return"
        description="Borrow-lend for items that come back — colors, sports kit, library-style loans."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
            <Button onClick={() => setIssueOpen(true)}><Plus /> Issue item</Button>
          </>
        }
      />

      <PageBody>
        <FilterBar>
          <SearchInput value={itemName} onValueChange={(v) => { setItemName(v); setPage(1); }} placeholder="Item name…" />
          <FilterField label="Status" width="sm">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as InventoryIssuanceStatus | ''); setPage(1); }}>
              <option value="">All</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_RETURNED">Partially returned</option>
              <option value="RETURNED">Returned</option>
              <option value="OVERDUE">Overdue</option>
            </Select>
          </FilterField>
          <FilterField label="Mobile" width="sm">
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
          emptyMessage="No items issued yet"
          toolbar={
            <>
              <BookUp className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">Issuances</span>
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
  const [item, setItem] = React.useState<InventoryItem | null>(null);
  const [manualCode, setManualCode] = React.useState('');
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [qty, setQty] = React.useState('1');
  const [borrowerType, setBorrowerType] = React.useState<InventoryBorrowerType>('STUDENT');
  const [studentId, setStudentId] = React.useState<number | null>(null);
  const [staffId, setStaffId] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxLoanDays);

  const lookup = React.useCallback(async (code: string) => {
    if (!code.trim()) return;
    try {
      const found = await lookupItem(code.trim());
      setItem(found);
      setScannerOpen(false);
    } catch {
      toast.error(`No item found for "${code}"`);
    }
  }, []);

  // A USB/Bluetooth gun types its payload and presses Enter. Issuing is the
  // other counter flow, so it gets the same zero-configuration support the
  // sell screen has — only while an item is still to be chosen, so a scan
  // can't overwrite one already picked.
  useKeyboardWedge(lookup, !item);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) { toast.error('Scan or search an item first'); return; }
    if (borrowerType === 'STUDENT' && !studentId) { toast.error('Select a student'); return; }
    if (borrowerType === 'STAFF' && !staffId) { toast.error('Select a staff member'); return; }
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
      toast.success('Item issued');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not issue the item'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Issue item</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            {item ? (
              <Panel>
                <PanelBody className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{item.name}</p>
                    <p className="text-[12px] text-ink-muted">{item.code} · {item.availableQty} available</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItem(null)}><Trash2 className="size-3.5" /></Button>
                </PanelBody>
              </Panel>
            ) : scannerOpen ? (
              <StableScanner onCode={lookup} onClose={() => setScannerOpen(false)} />
            ) : (
              <div className="space-y-2">
                <Button type="button" variant="outline" block onClick={() => setScannerOpen(true)}><ScanLine /> Scan item</Button>
                {/* A div, not a form: this sits inside the issue form, and a
                    nested <form> is invalid HTML — React warns, and Enter here
                    submits whichever form the browser guesses. Enter is wired
                    by hand so the code box still behaves as one expects. */}
                <div className="flex gap-2">
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void lookup(manualCode);
                      }
                    }}
                    placeholder="Or type the item code"
                  />
                  <Button type="button" variant="outline" onClick={() => void lookup(manualCode)}>Find</Button>
                </div>
              </div>
            )}

            <Field label="Quantity" required>
              <Input type="number" min="1" max={item?.availableQty} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </Field>

            <SegmentedControl
              value={borrowerType}
              onValueChange={(v) => setBorrowerType(v as InventoryBorrowerType)}
              options={[{ value: 'STUDENT', label: 'Student', icon: <User /> }, { value: 'STAFF', label: 'Staff', icon: <Users /> }]}
            />
            {borrowerType === 'STUDENT' ? (
              <StudentPicker value={studentId} onChange={(id) => setStudentId(id)} />
            ) : (
              <StaffPicker value={staffId} onChange={(id) => setStaffId(id)} label="" />
            )}

            <Field label="Due date" hint={`Defaults to ${defaultLoanDays} days from today; max ${maxLoanDays} days`}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} max={maxDate.toISOString().slice(0, 10)} />
            </Field>
            <Field label="Notes">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !item}>{saving ? 'Saving…' : 'Issue'}</Button>
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
  const outstanding = issuanceOutstanding(issuance);
  const [lines, setLines] = React.useState<ReturnLine[]>([{ condition: 'GOOD', qty: String(outstanding) }]);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const totalQty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const remaining = outstanding - totalQty;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQty <= 0 || totalQty > outstanding) { toast.error(`Return quantity must be between 1 and ${outstanding}`); return; }
    setSaving(true);
    try {
      await returnIssuance(issuance.id, {
        returns: lines.filter((l) => Number(l.qty) > 0).map((l) => ({ condition: l.condition, qty: Number(l.qty) })),
        note: note || undefined,
      });
      toast.success('Return recorded');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the return'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>Return — {issuance.itemName}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">Outstanding: {outstanding}. Remaining after this return: {remaining}</p>
            {lines.map((line, i) => (
              <FieldGrid key={i} columns={3}>
                <Field label="Condition">
                  <Select value={line.condition} onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, condition: e.target.value as InventoryReturnCondition } : l))}>
                    <option value="GOOD">Good</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="LOST">Lost</option>
                  </Select>
                </Field>
                <Field label="Qty">
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
              <Plus className="size-3.5" /> Add condition
            </Button>
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record return'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
