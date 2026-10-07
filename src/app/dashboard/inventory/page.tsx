'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useLocale, useTranslations } from 'next-intl';
import toast, { Toaster } from 'react-hot-toast';
import { AlertTriangle, Boxes, History, Package, Plus, Printer, RefreshCw, ScanBarcode, X } from 'lucide-react';

import { useRbac } from '@/lib/rbac';
import {
  adjustStock,
  checkItemCodeAvailable,
  createCategory,
  createItem,
  fetchCategories,
  fetchItems,
  fetchMovements,
  errorMessage,
  fetchNextItemCode,
  fetchPriceHistory,
  isLowStock,
  lookupItem,
  updateItem,
  type InventoryCategory,
  type InventoryItem,
  type InventoryItemPriceHistoryRow,
  type InventoryStockMovementRow,
  type InventoryStockMovementType,
} from '@/lib/inventory-api';

import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField, SearchInput } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/button';
import { Field, FieldGrid, Input, Select, Checkbox } from '@/components/ui/Field';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/ui/Money';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { StatusChip } from '@/components/ui/StatusChip';
import LabelPrintDialog from '@/components/inventory/LabelPrintDialog';
import { useKeyboardWedge } from '@/components/inventory/useKeyboardWedge';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

const PAGE_SIZE = 20;

export default function InventoryItemsPage() {
  const t = useTranslations('inventory.items');
  const tc = useTranslations('common');
  const rbac = useRbac();
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<number | ''>('');
  const [lowStockOnly, setLowStockOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const query = { search: search || undefined, categoryId: categoryId || undefined, lowStock: lowStockOnly || undefined, page, limit: PAGE_SIZE };
  const key = `/inventory/items?${JSON.stringify(query)}`;
  const { data, isLoading, mutate } = useSWR(key, () => fetchItems(query));

  const { data: categories, mutate: mutateCategories } = useSWR('/inventory/categories', fetchCategories);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InventoryItem | null>(null);
  const [stockItem, setStockItem] = React.useState<InventoryItem | null>(null);
  const [movementsItem, setMovementsItem] = React.useState<InventoryItem | null>(null);
  const [labelItems, setLabelItems] = React.useState<InventoryItem[] | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [catalogScanOpen, setCatalogScanOpen] = React.useState(false);

  /**
   * Scan-to-find on the catalogue itself: point the camera at a label on the
   * shelf and the row surfaces. Filtering by the resolved *code* rather than
   * the raw scan is what makes a signed `INV1:` token work here at all — the
   * token is not text the search endpoint could ever match.
   */
  const findByScan = React.useCallback(async (code: string) => {
    try {
      const found = await lookupItem(code.trim());
      setSearch(found.code);
      setPage(1);
      setCatalogScanOpen(false);
      toast.success(found.name);
    } catch (err) {
      toast.error(errorMessage(err, t('toast.notFound', { code })));
    }
  }, [t]);

  // A USB/Bluetooth gun works on this screen too, but only while no dialog is
  // open — a scan landing in the middle of an item form would be a menace.
  useKeyboardWedge(findByScan, !formOpen && !stockItem && !movementsItem && !labelItems);

  const columns: Column<InventoryItem>[] = [
    {
      key: 'code',
      header: t('col.code'),
      accessor: (row) => <span className="tabular font-mono text-[12px] text-ink-muted">{row.code}</span>,
      card: 'meta',
    },
    {
      key: 'name',
      header: t('col.item'),
      accessor: (row) => row.name,
      sortable: true,
      card: 'title',
    },
    {
      key: 'category',
      header: t('col.category'),
      accessor: (row) => row.category?.name ?? '—',
      card: 'meta',
    },
    {
      key: 'sellingPrice',
      header: t('col.price'),
      align: 'right',
      accessor: (row) => <Money amount={row.sellingPrice} symbol />,
      card: 'field',
    },
    {
      key: 'stock',
      header: t('col.stock'),
      align: 'right',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="tabular">
            {row.availableQty} / {row.totalQty}
          </span>
          {isLowStock(row) && (
            <span title={t('lowStock')}>
              <AlertTriangle className="size-3.5 text-accent-warn-deep" />
            </span>
          )}
        </span>
      ),
      card: 'field',
    },
    {
      key: 'status',
      header: '',
      align: 'right',
      card: 'trailing',
      accessor: (row) =>
        row.isActive ? null : <StatusChip status="INACTIVE" label={tc('status.inactive')} pigment="neutral" size="sm" />,
    },
    {
      key: 'actions',
      header: tc('action.actions'),
      align: 'right',
      // 'trailing', not 'hidden': hiding it left phones with no way to edit an
      // item, adjust stock or print a label — the whole row menu simply
      // vanished below md. It stacks under the status chip in the card.
      card: 'trailing',
      accessor: (row) => (
        <RowActionsMenu
          actions={[
            {
              label: tc('action.edit'),
              onSelect: () => {
                setEditing(row);
                setFormOpen(true);
              },
            },
            rbac.canManageInventory && {
              label: t('menu.adjustStock'),
              onSelect: () => setStockItem(row),
            },
            { label: t('menu.movements'), onSelect: () => setMovementsItem(row) },
            { label: t('menu.printLabel'), onSelect: () => setLabelItems([row]) },
          ]}
        />
      ),
    },
  ];

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <Button
              variant="outline"
              disabled={selectedIds.size === 0}
              onClick={() => setLabelItems((data?.data ?? []).filter((i) => selectedIds.has(i.id)))}
            >
              <Printer /> {t('printLabels', { count: selectedIds.size })}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> {t('addItem')}
            </Button>
          </>
        }
      />

      <PageBody>
        <FilterBar>
          {/* Search and scan are the same question asked two ways — "which
              item?" — so they share one row and one height, and the pair is
              full-width on a phone where they are the whole toolbar. */}
          {/* w-full alone on mobile (the pair owns the row); flex-1 only from
              sm — its basis-0 would otherwise beat w-full and let the category
              select crush the search box onto the same line. */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:max-w-96 sm:flex-1">
            <SearchInput
              value={search}
              onValueChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={t('searchPlaceholder')}
              className="max-w-none flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 sm:h-10"
              onClick={() => setCatalogScanOpen((open) => !open)}
              aria-pressed={catalogScanOpen}
            >
              <ScanBarcode className="size-4" /> {catalogScanOpen ? tc('action.close') : t('scan')}
            </Button>
          </div>
          <FilterField label={t('col.category')} width="md">
            <Select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
            >
              <option value="">{t('allCategories')}</option>
              {categories?.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t('stock')} width="md">
            <Checkbox
              label={t('lowStockOnly')}
              checked={lowStockOnly}
              onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }}
            />
          </FilterField>
        </FilterBar>

        {catalogScanOpen && (
          <div className="mt-3 max-w-sm">
            <ScannerInline onCode={findByScan} onClose={() => setCatalogScanOpen(false)} />
          </div>
        )}

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(row) => row.id}
          isRowSelected={(row) => selectedIds.has(row.id)}
          onRowClick={(row) => toggleSelect(row.id)}
          emptyMessage={t('empty')}
          toolbar={
            <>
              <Boxes className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('catalog')}</span>
              {data && <TableCount>{data.total}</TableCount>}
              <span className="ml-auto text-[12px] text-ink-faint">{t('tapToSelect')}</span>
            </>
          }
          footer={
            data && data.total > PAGE_SIZE ? (
              <span className="text-[12.5px] text-ink-muted">
                {t('pageOf', { page, pages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)) })}
              </span>
            ) : undefined
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tc('action.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tc('action.next')}</Button>
          </div>
        )}
      </PageBody>

      {formOpen && (
        <ItemFormDialog
          item={editing}
          categories={categories ?? []}
          onCreateCategory={async (name) => {
            const created = await createCategory(name);
            // Await the refetch so the <option> exists before the dialog
            // selects it — otherwise the select is handed an id it has no
            // option for and silently falls back to blank.
            await mutateCategories();
            return created;
          }}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            mutate();
          }}
        />
      )}

      {stockItem && (
        <StockAdjustDialog
          item={stockItem}
          onClose={() => setStockItem(null)}
          onSaved={() => {
            setStockItem(null);
            mutate();
          }}
        />
      )}

      {movementsItem && (
        <MovementsDialog item={movementsItem} onClose={() => setMovementsItem(null)} />
      )}

      {labelItems && (
        <LabelPrintDialog items={labelItems} onClose={() => setLabelItems(null)} />
      )}
    </PageShell>
  );
}

/* ── Item form ────────────────────────────────────────────────────────── */

function ItemFormDialog({
  item,
  categories,
  onCreateCategory,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  categories: InventoryCategory[];
  onCreateCategory: (name: string) => Promise<InventoryCategory>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('inventory.itemForm');
  const tc = useTranslations('common');
  const [name, setName] = React.useState(item?.name ?? '');
  const [categoryId, setCategoryId] = React.useState<number | ''>(item?.categoryId ?? '');
  const [code, setCode] = React.useState(item?.code ?? '');
  const [barcode, setBarcode] = React.useState(item?.barcode ?? '');
  const [mrp, setMrp] = React.useState(item?.mrp != null ? String(item.mrp) : '');
  const [discountType, setDiscountType] = React.useState(item?.catalogDiscountType ?? '');
  const [discountValue, setDiscountValue] = React.useState(item?.catalogDiscountValue != null ? String(item.catalogDiscountValue) : '');
  const [sellingPriceOverride, setSellingPriceOverride] = React.useState(item?.sellingPrice != null ? String(item.sellingPrice) : '');
  const [priceEditedManually, setPriceEditedManually] = React.useState(!!item);
  const [costPrice, setCostPrice] = React.useState(item?.costPrice != null ? String(item.costPrice) : '');
  // Blank, not 'pcs'. A prefilled default that most schools keep still has to
  // be cleared by everybody who doesn't — and worse, a text box holding "pcs"
  // next to nothing else numeric reads as "how many", which is how items get
  // created with no opening stock at all.
  const [unit, setUnit] = React.useState(item?.unit ?? '');
  const [reorderLevel, setReorderLevel] = React.useState(item?.reorderLevel != null ? String(item.reorderLevel) : '');
  const [description, setDescription] = React.useState(item?.description ?? '');
  const [openingQty, setOpeningQty] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [savingCategory, setSavingCategory] = React.useState(false);

  const cancelAddCategory = () => {
    setAddingCategory(false);
    setNewCategoryName('');
  };

  /**
   * Creating a category from inside an item form only ever means "…and put
   * this item in it". Selecting it here saves hunting for the new name in a
   * dropdown that just grew, and makes the round trip feel like one action.
   */
  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || savingCategory) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      cancelAddCategory();
      toast(t('categoryExists', { name: existing.name }));
      return;
    }
    setSavingCategory(true);
    try {
      const created = await onCreateCategory(name);
      if (created) setCategoryId(created.id);
      cancelAddCategory();
      toast.success(t('categoryAdded', { name }));
    } catch (err) {
      toast.error(errorMessage(err, t('categoryAddFailed')));
    } finally {
      setSavingCategory(false);
    }
  };

  React.useEffect(() => {
    if (item || code) return;
    fetchNextItemCode().then((r) => setCode(r.code)).catch(() => {});
  }, [item, code]);

  /**
   * The suggestion is only a suggestion — codes are editable and a school may
   * already own the number we guessed. So the field says, out loud, whether
   * what is in it right now is free, instead of letting the operator find out
   * from a failed save.
   */
  // Only the *answer* is state; what's on screen is derived from it, so a
  // reply for a code the operator has since typed past is simply stale rather
  // than briefly wrong.
  const [codeCheck, setCodeCheck] = React.useState<
    { code: string; available: boolean; reason?: string } | null
  >(null);

  React.useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === item?.code) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkItemCodeAvailable(trimmed, item?.id)
        .then((res) => {
          if (!cancelled) setCodeCheck({ code: trimmed, ...res });
        })
        .catch(() => {});
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, item?.code, item?.id]);

  const codeStatus = React.useMemo(():
    | { state: 'idle' | 'checking' | 'ok' }
    | { state: 'taken'; reason: string } => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === item?.code) return { state: 'idle' };
    if (codeCheck?.code !== trimmed) return { state: 'checking' };
    return codeCheck.available
      ? { state: 'ok' }
      : { state: 'taken', reason: codeCheck.reason ?? t('codeInUse') };
  }, [code, codeCheck, item?.code, t]);

  // Derived, not stored: MRP - discount computes the selling price live,
  // unless the operator has typed into the price field directly (then their
  // override wins until they change MRP/discount again).
  const autoComputedPrice = React.useMemo(() => {
    const mrpNum = Number(mrp);
    const discNum = Number(discountValue);
    if (!mrp || Number.isNaN(mrpNum)) return '';
    if (!discountType || !discountValue || Number.isNaN(discNum)) return mrp;
    const computed = discountType === 'PERCENT' ? mrpNum - (mrpNum * discNum) / 100 : mrpNum - discNum;
    return (Math.round(computed * 100) / 100).toString();
  }, [mrp, discountType, discountValue]);
  const sellingPrice = priceEditedManually ? sellingPriceOverride : autoComputedPrice;

  const handleScan = (value: string) => {
    setBarcode(value);
    setScanning(false);
    toast.success(t('captured', { value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) { toast.error(t('chooseCategory')); return; }
    if (codeStatus.state === 'taken') { toast.error(t('codeNotAvailable', { reason: codeStatus.reason })); return; }
    const dto = {
      name,
      categoryId: Number(categoryId),
      code,
      barcode: barcode || undefined,
      mrp: mrp ? Number(mrp) : undefined,
      catalogDiscountType: discountType ? (discountType as 'PERCENT' | 'FLAT') : undefined,
      catalogDiscountValue: discountValue ? Number(discountValue) : undefined,
      sellingPrice: Number(sellingPrice),
      costPrice: costPrice ? Number(costPrice) : undefined,
      // Blank means "whatever the server's default is" (pcs), not an empty unit.
      unit: unit.trim() || undefined,
      reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
      description: description || undefined,
    };
    setSaving(true);
    try {
      if (item) {
        await updateItem(item.id, dto);
        toast.success(t('updated'));
      } else {
        await createItem({ ...dto, openingQty: openingQty ? Number(openingQty) : undefined });
        toast.success(t('created'));
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-4">
            <FieldGrid>
              <Field label={tc('field.name')} required wide>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label={t('category')} required>
                <div className="flex gap-1.5">
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} required>
                    <option value="">{tc('state.selectPlaceholder')}</option>
                    {categories.filter((c) => c.isActive).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                  <Button type="button" variant="outline" size="icon" title={t('newCategory')} onClick={() => setAddingCategory(true)}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                {addingCategory && (
                  <div className="mt-2">
                    <div className="flex gap-1.5">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          // Inside the item form, so Enter must not submit it.
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addCategory();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelAddCategory();
                          }
                        }}
                        placeholder={t('newCategoryName')}
                        autoFocus
                      />
                      <Button type="button" size="sm" disabled={!newCategoryName.trim() || savingCategory} onClick={() => void addCategory()}>
                        {savingCategory ? t('adding') : tc('action.add')}
                      </Button>
                      {/* Opened by mistake is the common case — there has to be
                          a way out that isn't abandoning the whole item form. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={tc('action.cancel')}
                        aria-label={t('cancelAddCategory')}
                        onClick={cancelAddCategory}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {t('categoryHint')}
                    </p>
                  </div>
                )}
              </Field>
              <Field label={t('unit')} hint={t('unitHint')}>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
              </Field>
              {!item && (
                <Field label={t('openingQty')} hint={t('openingQtyHint')}>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={openingQty}
                    onChange={(e) => setOpeningQty(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              )}
              <Field
                label={t('code')}
                required
                hint={
                  codeStatus.state === 'checking'
                    ? t('codeChecking')
                    : codeStatus.state === 'ok'
                      ? t('codeAvailable')
                      : codeStatus.state === 'taken'
                        ? `✕ ${codeStatus.reason}`
                        : t('codeSuggested')
                }
              >
                <div className="flex gap-1.5">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    aria-invalid={codeStatus.state === 'taken'}
                    className={codeStatus.state === 'taken' ? 'border-accent-danger-edge' : undefined}
                  />
                  {!item && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('suggestCode')}
                      onClick={() => fetchNextItemCode().then((r) => setCode(r.code)).catch(() => {})}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                </div>
              </Field>
              <Field
                label={t('barcode')}
                hint={t('barcodeHint')}
              >
                <div className="flex gap-1.5">
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setScanning(true)}>
                    <ScanBarcode className="size-4" />
                  </Button>
                </div>
              </Field>
            </FieldGrid>

            {scanning && (
              <Panel>
                <PanelBody>
                  <ScannerInline onCode={handleScan} onClose={() => setScanning(false)} />
                </PanelBody>
              </Panel>
            )}

            <Panel>
              <PanelHeader title={t('pricing')} description={t('pricingHint')} />
              <PanelBody className="space-y-3">
                <FieldGrid columns={3}>
                  <Field label={t('mrp')}>
                    <Input type="number" step="0.01" min="0" value={mrp} onChange={(e) => setMrp(e.target.value)} />
                  </Field>
                  <Field label={t('discountType')}>
                    <Select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                      <option value="">{t('discountNone')}</option>
                      <option value="PERCENT">{t('discountPercent')}</option>
                      <option value="FLAT">{t('discountFlat')}</option>
                    </Select>
                  </Field>
                  <Field label={discountType === 'PERCENT' ? t('discountPct') : t('discountRs')}>
                    <Input type="number" step="0.01" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} disabled={!discountType} />
                  </Field>
                </FieldGrid>
                <FieldGrid columns={2}>
                  <Field label={t('sellingPrice')} required hint={t('sellingPriceHint')}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellingPrice}
                      onChange={(e) => { setSellingPriceOverride(e.target.value); setPriceEditedManually(true); }}
                      required
                    />
                  </Field>
                  <Field label={t('costPrice')} hint={t('costPriceHint')}>
                    <Input type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                  </Field>
                </FieldGrid>
              </PanelBody>
            </Panel>

            <FieldGrid>
              <Field label={t('reorderLevel')} hint={t('reorderLevelHint')}>
                <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
              </Field>
            </FieldGrid>

            <Field label={tc('field.description')}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc('action.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? tc('action.saving') : item ? t('saveChanges') : t('createItem')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScannerInline({ onCode, onClose }: { onCode: (v: string) => void; onClose: () => void }) {
  const [Comp, setComp] = React.useState<React.ComponentType<{ onCode: (v: string) => void; onClose?: () => void }> | null>(null);
  React.useEffect(() => {
    import('@/components/inventory/StableScanner').then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return null;
  return <Comp onCode={onCode} onClose={onClose} />;
}

/* ── Stock adjust ─────────────────────────────────────────────────────── */

function StockAdjustDialog({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('inventory.stock');
  const tc = useTranslations('common');
  const [type, setType] = React.useState<'PURCHASE' | 'ADJUSTMENT'>('PURCHASE');
  const [qty, setQty] = React.useState('');
  const [direction, setDirection] = React.useState<'in' | 'out'>('in');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) { toast.error(t('enterQty')); return; }
    setSaving(true);
    try {
      await adjustStock(item.id, { qtyDelta: direction === 'in' ? n : -n, type, note: note || undefined });
      toast.success(t('updated'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('updateFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('title', { name: item.name })}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            <p className="text-[12.5px] text-ink-muted">
              {t.rich('current', { available: () => <Money amount={item.availableQty} />, total: () => <Money amount={item.totalQty} /> })}
            </p>
            <FieldGrid>
              <Field label={t('reason')}>
                <Select value={type} onChange={(e) => setType(e.target.value as 'PURCHASE' | 'ADJUSTMENT')}>
                  <option value="PURCHASE">{t('reasonPurchase')}</option>
                  <option value="ADJUSTMENT">{t('reasonAdjustment')}</option>
                </Select>
              </Field>
              <Field label={t('direction')}>
                <Select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
                  <option value="in">{t('add')}</option>
                  <option value="out">{t('remove')}</option>
                </Select>
              </Field>
              <Field label={t('qty')} required>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
              </Field>
            </FieldGrid>
            <Field label={t('note')} hint={t('noteHint')}>
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

/* ── Movements + price history ───────────────────────────────────────── */

function MovementsDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const t = useTranslations('inventory.movements');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const [tab, setTab] = React.useState<'movements' | 'prices'>('movements');
  const [page, setPage] = React.useState(1);
  const { data: movements } = useSWR(
    tab === 'movements' ? [`inv-movements`, item.id, page] : null,
    () => fetchMovements(item.id, page, 20),
  );
  const { data: priceHistory } = useSWR(
    tab === 'prices' ? [`inv-prices`, item.id, page] : null,
    () => fetchPriceHistory(item.id, page, 20),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex gap-1 border-b border-line">
          <button
            type="button"
            onClick={() => { setTab('movements'); setPage(1); }}
            className={`px-3 py-2 text-[13px] font-semibold ${tab === 'movements' ? 'border-b-2 border-brand text-brand' : 'text-ink-muted'}`}
          >
            <History className="mr-1 inline size-3.5" /> {t('tabMovements')}
          </button>
          <button
            type="button"
            onClick={() => { setTab('prices'); setPage(1); }}
            className={`px-3 py-2 text-[13px] font-semibold ${tab === 'prices' ? 'border-b-2 border-brand text-brand' : 'text-ink-muted'}`}
          >
            <Package className="mr-1 inline size-3.5" /> {t('tabPrices')}
          </button>
        </div>

        <div className="mt-3 max-h-96 overflow-y-auto">
          {tab === 'movements' ? (
            <ul className="divide-y divide-line">
              {(movements?.data ?? []).map((m: InventoryStockMovementRow) => (
                <li key={m.id} className="py-2 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{t.has(`type.${m.type}`) ? t(`type.${m.type}` as `type.${InventoryStockMovementType}`) : m.type.replace(/_/g, ' ')}</span>
                    <span className={m.qtyDelta >= 0 ? 'tabular text-accent-success-deep' : 'tabular text-accent-danger-deep'}>
                      {m.qtyDelta >= 0 ? '+' : ''}{m.qtyDelta}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-muted">
                    {t('after', { available: m.availableAfter, total: m.totalAfter })} · {new Date(m.createdAt).toLocaleString(INTL_LOCALE[locale])}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </li>
              ))}
              {movements && movements.data.length === 0 && (
                <p className="py-6 text-center text-[13px] text-ink-muted">{t('noMovements')}</p>
              )}
            </ul>
          ) : (
            <ul className="divide-y divide-line">
              {(priceHistory?.data ?? []).map((p: InventoryItemPriceHistoryRow) => (
                <li key={p.id} className="py-2 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink"><Money amount={p.sellingPrice} symbol /></span>
                    <span className="text-[12px] text-ink-muted">{new Date(p.createdAt).toLocaleString(INTL_LOCALE[locale])}</span>
                  </div>
                  <p className="text-[12px] text-ink-muted">
                    {p.mrp != null ? t('mrp', { value: p.mrp }) : t('noMrp')}
                    {p.catalogDiscountType ? ` · ${t('off', { value: p.catalogDiscountType === 'PERCENT' ? `${p.catalogDiscountValue}%` : `₹${p.catalogDiscountValue}` })}` : ''}
                    {p.changedBy ? ` · ${t('by', { name: `${p.changedBy.firstName} ${p.changedBy.lastName}` })}` : ''}
                  </p>
                </li>
              ))}
              {priceHistory && priceHistory.data.length === 0 && (
                <p className="py-6 text-center text-[13px] text-ink-muted">{t('noPrices')}</p>
              )}
            </ul>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{tc('action.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
