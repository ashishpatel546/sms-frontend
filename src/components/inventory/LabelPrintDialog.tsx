'use client';

import * as React from 'react';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Field';
import { errorMessage, generateLabels, type InventoryItem } from '@/lib/inventory-api';
import {
  LABEL_FORMAT_OPTIONS,
  downloadInventoryLabelSheet,
  labelsPerSheet,
  sheetCount,
  unencodableCodes,
  type LabelFormat,
} from '@/lib/inventory-label-pdf';
import { isEncodableCode128B } from '@/lib/code128';

/**
 * Multi-select items on the catalog, choose how many labels each needs, and
 * get one A4 sheet to cut apart and stick on stock. The symbols are generated
 * client-side from the signed token the backend hands back — the same
 * division of labour the ID-card batch uses.
 *
 * The format choice is a hardware question, not a taste one: pick QR when
 * staff scan with phones, barcode when the school owns 1-D laser guns, both
 * when either might happen at the counter.
 */
export default function LabelPrintDialog({
  items,
  onClose,
}: {
  items: InventoryItem[];
  onClose: () => void;
}) {
  const [copies, setCopies] = React.useState<Record<number, number>>(
    () => Object.fromEntries(items.map((i) => [i.id, 1])),
  );
  const [format, setFormat] = React.useState<LabelFormat>('QR_AND_BARCODE');
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [building, setBuilding] = React.useState(false);

  const totalRequested = Object.values(copies).reduce((sum, n) => sum + Math.max(1, n || 1), 0);
  const sheets = sheetCount(totalRequested, format);

  // Code 128-B carries printable ASCII only. A code with, say, a Devanagari
  // character can still be printed as QR — it just cannot become a barcode,
  // and saying so up front beats a blank strip on 200 printed labels.
  const nonAscii = items.filter((i) => !isEncodableCode128B(i.code)).map((i) => i.code);
  const barcodeWanted = format !== 'QR_ONLY';
  const blocked = barcodeWanted && format === 'BARCODE_ONLY' && nonAscii.length === items.length;

  const print = async () => {
    setBuilding(true);
    setProgress({ done: 0, total: totalRequested });
    try {
      const labels = await generateLabels(items.map((i) => ({ itemId: i.id, copies: copies[i.id] || 1 })));
      const skipped = barcodeWanted ? unencodableCodes(labels) : [];
      await downloadInventoryLabelSheet(labels, format, (done, total) => setProgress({ done, total }));
      if (skipped.length > 0) {
        toast(`${skipped.length} label${skipped.length === 1 ? '' : 's'} printed without a barcode — code not ASCII`);
      }
      toast.success('Label sheet downloaded');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not build the label sheet'));
    } finally {
      setBuilding(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print labels</DialogTitle>
        </DialogHeader>

        <div className="mt-3">
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Label format</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LABEL_FORMAT_OPTIONS.map((option) => {
              const active = format === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  aria-pressed={active}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-brand bg-brand-tint text-ink'
                      : 'border-line text-ink-muted hover:border-line-strong'
                  }`}
                >
                  <span className="block text-[13px] font-medium text-ink">{option.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-ink">{item.name}</p>
                <p className="text-[12px] text-ink-muted">{item.code}</p>
              </div>
              <Input
                type="number"
                min={1}
                value={copies[item.id]}
                onChange={(e) =>
                  setCopies((prev) => ({ ...prev, [item.id]: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-20 text-center"
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[12.5px] text-ink-muted">
          {totalRequested} label{totalRequested === 1 ? '' : 's'} · {sheets} A4 sheet
          {sheets === 1 ? '' : 's'} ({labelsPerSheet(format)} per sheet)
        </p>
        {barcodeWanted && nonAscii.length > 0 && (
          <p className="mt-1 text-[12.5px] text-amber-700">
            {nonAscii.length} item code{nonAscii.length === 1 ? '' : 's'} cannot be encoded as a barcode
            {blocked ? ' — choose a QR format instead.' : ' and will print QR-only.'}
          </p>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={building}>Cancel</Button>
          <Button type="button" onClick={print} disabled={building || blocked}>
            <Printer />
            {building ? (progress ? `Building ${progress.done}/${progress.total}…` : 'Building…') : 'Download PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
