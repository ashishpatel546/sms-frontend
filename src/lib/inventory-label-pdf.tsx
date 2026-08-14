import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { InventoryLabel } from './inventory-api';
import { isEncodableCode128B, renderCode128DataUrl } from './code128';

/* ═══════════════════════════════════════════════════════════════════════════
   INVENTORY LABELS — one A4 sheet, cut apart and stuck on stock.

   Modelled on the id-card A4 sheet (`id-card-pdf.tsx`): fixed physical size,
   nothing fetched inside the PDF tree (every symbol is rendered to a data URL
   first — a failed remote image would take the whole document down), and a
   pooled renderer so a big print run doesn't serialise 200 encodes.

   Ten identical notebooks share one label design — the count comes from
   how many copies the office asked to print, not from physical units.

   THREE FORMATS, because the scanner on the counter decides which is useful:
   a phone camera reads QR far more reliably than 1-D, while the cheap laser
   guns schools already own read *only* 1-D. The QR carries the signed token;
   the barcode carries the plain item code, which `/inventory/items/lookup`
   resolves just the same.
   ═══════════════════════════════════════════════════════════════════════════ */

export type LabelFormat = 'QR_AND_BARCODE' | 'QR_ONLY' | 'BARCODE_ONLY';

export const LABEL_FORMAT_OPTIONS: { value: LabelFormat; label: string; hint: string }[] = [
  {
    value: 'QR_AND_BARCODE',
    label: 'QR + barcode',
    hint: 'Works with phone cameras and 1-D laser scanners',
  },
  { value: 'QR_ONLY', label: 'QR only', hint: 'Smallest label, most per sheet' },
  { value: 'BARCODE_ONLY', label: 'Barcode only', hint: 'For 1-D laser scanners' },
];

const A4_W = 595.28;
const A4_H = 841.89;
const GAP = 6;

interface Layout {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  qr: number;
  /** Printed width/height of the barcode image, in PDF points. */
  barW: number;
  barH: number;
}

/**
 * Per-format grid. Barcode widths are chosen so the narrow module stays near
 * 0.4 mm at print size — below roughly 0.25 mm, cheap scanners start failing
 * on toner spread, which is exactly the hardware this format exists for.
 */
const LAYOUTS: Record<LabelFormat, Layout> = {
  QR_AND_BARCODE: { cols: 3, rows: 6, cellW: 176, cellH: 132, qr: 62, barW: 158, barH: 28 },
  QR_ONLY: { cols: 4, rows: 6, cellW: 130, cellH: 130, qr: 84, barW: 0, barH: 0 },
  BARCODE_ONLY: { cols: 3, rows: 10, cellW: 176, cellH: 76, qr: 0, barW: 158, barH: 40 },
};

export function labelsPerSheet(format: LabelFormat): number {
  const l = LAYOUTS[format];
  return l.cols * l.rows;
}

const INK = '#211c16';
const INK_MUTED = '#756d65';
const LINE = '#cdc5b7';

function stylesFor(format: LabelFormat) {
  const l = LAYOUTS[format];
  const blockW = l.cellW * l.cols + GAP * (l.cols - 1);
  const blockH = l.cellH * l.rows + GAP * (l.rows - 1);
  return StyleSheet.create({
    page: {
      paddingTop: (A4_H - blockH) / 2,
      paddingLeft: (A4_W - blockW) / 2,
      backgroundColor: '#ffffff',
    },
    grid: { width: blockW, flexDirection: 'row', flexWrap: 'wrap' },
    cell: {
      width: l.cellW,
      height: l.cellH,
      marginRight: GAP,
      marginBottom: GAP,
      border: '0.75pt dashed ' + LINE,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 5,
    },
    qr: { width: l.qr, height: l.qr },
    barcode: { width: l.barW, height: l.barH, marginTop: 3 },
    name: {
      marginTop: 3,
      fontSize: 7,
      fontFamily: 'Helvetica-Bold',
      color: INK,
      textAlign: 'center',
      maxWidth: l.cellW - 10,
    },
    code: {
      marginTop: 1,
      fontSize: 6.5,
      fontFamily: 'Courier-Bold',
      color: INK_MUTED,
      letterSpacing: 0.4,
    },
  });
}

interface PreparedLabel {
  name: string;
  code: string;
  qrDataUrl: string | null;
  barcodeDataUrl: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Bounded concurrency so a 200-label batch doesn't fire 200 encodes at once. */
async function mapPooled<T, R>(
  items: T[],
  size: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Item codes a 1-D scanner could never read — reported before a long render. */
export function unencodableCodes(labels: InventoryLabel[]): string[] {
  return labels.filter((l) => !isEncodableCode128B(l.code)).map((l) => l.code);
}

/**
 * Renders each label's symbols to data URLs. `onProgress` reports resolved
 * labels so a big batch shows real progress rather than a stuck spinner.
 *
 * Identical labels are encoded once and shared: printing 50 copies of one
 * notebook is one QR encode, not 50.
 */
export async function prepareInventoryLabels(
  labels: InventoryLabel[],
  format: LabelFormat,
  onProgress?: (done: number, total: number) => void,
): Promise<PreparedLabel[]> {
  const { default: QRCode } = await import('qrcode');
  const wantsQr = format !== 'BARCODE_ONLY';
  const wantsBarcode = format !== 'QR_ONLY';

  let done = 0;
  const total = labels.reduce((sum, l) => sum + Math.max(1, l.copies), 0);

  const rendered = await mapPooled(labels, 6, async (label) => {
    const qrDataUrl = wantsQr
      ? await QRCode.toDataURL(label.token, {
          errorCorrectionLevel: 'M',
          margin: 0,
          width: 320,
          color: { dark: '#1c150dff', light: '#ffffffff' },
        })
      : null;
    // Synchronous canvas work, but kept inside the pool so progress ticks
    // at the same rate for every format.
    const barcodeDataUrl =
      wantsBarcode && isEncodableCode128B(label.code)
        ? renderCode128DataUrl(label.code, {
            moduleWidth: 3,
            height: format === 'BARCODE_ONLY' ? 78 : 52,
            showText: true,
            fontSize: format === 'BARCODE_ONLY' ? 20 : 16,
          })
        : null;
    done += Math.max(1, label.copies);
    onProgress?.(done, total);
    return { name: label.name, code: label.code, qrDataUrl, barcodeDataUrl };
  });

  // Expand to physical labels only after encoding, so copies are free.
  const out: PreparedLabel[] = [];
  labels.forEach((label, i) => {
    for (let c = 0; c < Math.max(1, label.copies); c += 1) out.push(rendered[i]);
  });
  return out;
}

type Styles = ReturnType<typeof stylesFor>;

function LabelCell({ label, styles }: { label: PreparedLabel; styles: Styles }) {
  return (
    <View style={styles.cell} wrap={false}>
      {label.qrDataUrl && <Image src={label.qrDataUrl} style={styles.qr} />}
      <Text style={styles.name}>{label.name}</Text>
      {label.barcodeDataUrl ? (
        <Image src={label.barcodeDataUrl} style={styles.barcode} />
      ) : (
        // Either QR-only, or a code Code 128-B cannot carry — the human-
        // readable code still has to be on the label either way.
        <Text style={styles.code}>{label.code}</Text>
      )}
    </View>
  );
}

export function InventoryLabelSheetDocument({
  labels,
  format,
}: {
  labels: PreparedLabel[];
  format: LabelFormat;
}) {
  const styles = stylesFor(format);
  const pages = chunk(labels, labelsPerSheet(format));
  return (
    <Document>
      {pages.map((page, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {page.map((label, j) => (
              <LabelCell key={j} label={label} styles={styles} />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const canDownload = 'download' in HTMLAnchorElement.prototype;
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  if (!canDownload) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (!canDownload) window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadInventoryLabelSheet(
  labels: InventoryLabel[],
  format: LabelFormat = 'QR_AND_BARCODE',
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const prepared = await prepareInventoryLabels(labels, format, onProgress);
  const blob = await pdf(
    <InventoryLabelSheetDocument labels={prepared} format={format} />,
  ).toBlob();
  saveBlob(blob, `inventory-labels_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function sheetCount(labelCount: number, format: LabelFormat): number {
  return Math.max(1, Math.ceil(labelCount / labelsPerSheet(format)));
}

export function totalLabelCount(labels: InventoryLabel[]): number {
  return labels.reduce((sum, l) => sum + Math.max(1, l.copies), 0);
}
