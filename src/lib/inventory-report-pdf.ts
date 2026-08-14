import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Vector-text tabular PDF export for the inventory reports, in the mould of
 * `attendance-report-pdf.ts` — jsPDF + autoTable rather than a rasterised
 * screenshot, which is what keeps a 200-row report legible when printed.
 * `@react-pdf/renderer` stays reserved for the label sheets, where absolute
 * print-accurate layout matters more than table density.
 */
export function buildInventoryReportPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  const doc = new jsPDF({ orientation: rows.length && headers.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(15);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 20);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [124, 73, 7] },
  });

  doc.save(filename);
}
