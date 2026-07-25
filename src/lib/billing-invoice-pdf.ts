import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceCompanyProfile {
  companyName?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  pan?: string | null;
  gstin?: string | null;
  invoiceFooterNote?: string | null;
}

export interface InvoiceDetail {
  invoiceNumber: string;
  type: 'PERIOD' | 'TRUEUP';
  status: string;
  periodLabel: string;
  studentCount: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPaise: number;
    amountPaise: number;
  }>;
  subtotalPaise: number;
  discountBreakdown: {
    slabPercent: number;
    slabPaise: number;
    frequencyPercent: number;
    frequencyPaise: number;
    negotiatedPaise: number;
    trialPercent: number;
    trialPaise: number;
    totalDiscountPaise: number;
  };
  gstEnabled: boolean;
  gstPercent: number;
  gstin: string | null;
  gstPaise: number;
  totalPaise: number;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  offlineReference: string | null;
  planName?: string;
  companyProfile: InvoiceCompanyProfile;
  billTo: {
    name: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

function rupees(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function addressLines(
  source: Record<string, unknown> | null | undefined,
): string[] {
  if (!source) return [];
  const parts = [
    source.addressLine1,
    source.addressLine2,
    [source.city, source.state].filter(Boolean).join(', '),
    source.postalCode,
  ];
  return parts.filter((p): p is string => Boolean(p));
}

/**
 * Renders the invoice PDF in the browser.
 *
 * Everything printed comes from the invoice's own snapshot, so reprinting an
 * old invoice years later still shows the company details and tax treatment
 * that applied when it was issued.
 */
export function downloadInvoicePdf(
  invoice: InvoiceDetail,
  logoDataUrl?: string | null,
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const company = invoice.companyProfile ?? {};
  let y = margin;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 60, y, 60, 60);
    } catch {
      // A malformed logo must never stop someone downloading their invoice.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.companyName ?? 'Invoice', margin, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  let lineY = y + 30;
  for (const line of addressLines(company as Record<string, unknown>)) {
    doc.text(line, margin, lineY);
    lineY += 12;
  }
  const contact = [company.phone, company.email, company.website]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) {
    doc.text(contact, margin, lineY);
    lineY += 12;
  }
  for (const [label, value] of [
    ['GSTIN', company.gstin],
    ['PAN', company.pan],
  ] as const) {
    if (value) {
      doc.text(`${label}: ${value}`, margin, lineY);
      lineY += 12;
    }
  }

  y = Math.max(lineY, y + 70) + 10;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('TAX INVOICE', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const metaX = pageWidth - margin - 200;
  doc.text(`Invoice No:  ${invoice.invoiceNumber}`, metaX, y - 10);
  doc.text(`Issued:  ${formatDate(invoice.issuedAt)}`, metaX, y + 2);
  doc.text(`Due:  ${formatDate(invoice.dueDate)}`, metaX, y + 14);
  y += 28;

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILL TO', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90);
  y += 13;
  if (invoice.billTo) {
    doc.text(invoice.billTo.name, margin, y);
    y += 12;
    for (const line of addressLines(
      invoice.billTo as unknown as Record<string, unknown>,
    )) {
      doc.text(line, margin, y);
      y += 12;
    }
    const schoolContact = [invoice.billTo.email, invoice.billTo.phone]
      .filter(Boolean)
      .join('  ·  ');
    if (schoolContact) {
      doc.text(schoolContact, margin, y);
      y += 12;
    }
  }

  doc.setTextColor(90);
  doc.text(`Billing period:  ${invoice.periodLabel}`, margin, y);
  y += 12;
  if (invoice.type === 'TRUEUP') {
    doc.text(
      `Additional students admitted during the period: ${invoice.studentCount}`,
      margin,
      y,
    );
    y += 12;
  }

  const body: Array<[string, string, string, string]> = invoice.lineItems.map(
    (item) => [
      item.description,
      String(item.quantity),
      rupees(item.unitPaise),
      rupees(item.amountPaise),
    ],
  );

  autoTable(doc, {
    startY: y + 8,
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 50 },
      2: { halign: 'right', cellWidth: 80 },
      3: { halign: 'right', cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  const discount = invoice.discountBreakdown;
  const totals: Array<[string, string]> = [['Subtotal', rupees(invoice.subtotalPaise)]];
  if (discount.slabPaise > 0) {
    totals.push([
      `Volume discount (${discount.slabPercent}%)`,
      `- ${rupees(discount.slabPaise)}`,
    ]);
  }
  if (discount.frequencyPaise > 0) {
    totals.push([
      `Payment frequency discount (${discount.frequencyPercent}%)`,
      `- ${rupees(discount.frequencyPaise)}`,
    ]);
  }
  if (discount.negotiatedPaise > 0) {
    totals.push([
      'Negotiated discount',
      `- ${rupees(discount.negotiatedPaise)}`,
    ]);
  }
  if (discount.trialPaise > 0) {
    totals.push([
      `Trial discount (${discount.trialPercent}%)`,
      `- ${rupees(discount.trialPaise)}`,
    ]);
  }
  if (invoice.gstEnabled) {
    totals.push([`GST (${invoice.gstPercent}%)`, rupees(invoice.gstPaise)]);
  }
  totals.push(['Total payable', rupees(invoice.totalPaise)]);

  autoTable(doc, {
    // @ts-expect-error — lastAutoTable is attached by the plugin at runtime.
    startY: (doc.lastAutoTable?.finalY ?? y) + 12,
    body: totals,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { halign: 'right', cellWidth: pageWidth - margin * 2 - 120 },
      1: { halign: 'right', cellWidth: 120, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.row.index === totals.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 11;
      }
    },
  });

  // @ts-expect-error — see above.
  let footerY = (doc.lastAutoTable?.finalY ?? y) + 24;

  doc.setFontSize(9);
  if (invoice.paidAt) {
    doc.setTextColor(16, 122, 87);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `PAID on ${formatDate(invoice.paidAt)}${
        invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ''
      }${invoice.offlineReference ? ` (Ref: ${invoice.offlineReference})` : ''}`,
      margin,
      footerY,
    );
    footerY += 18;
  } else if (invoice.status === 'VOID') {
    doc.setTextColor(150);
    doc.setFont('helvetica', 'bold');
    doc.text('VOID — this invoice has been cancelled', margin, footerY);
    footerY += 18;
  }

  if (company.invoiceFooterNote) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.setFontSize(8);
    const wrapped = doc.splitTextToSize(
      company.invoiceFooterNote,
      pageWidth - margin * 2,
    );
    doc.text(wrapped, margin, footerY);
  }

  doc.save(`${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`);
}
