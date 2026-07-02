/**
 * receipt-html-template.ts
 *
 * Generates a self-contained HTML string for the fee receipt, intended to be
 * rendered by Puppeteer server-side into a PDF. All styles are inline / in a
 * <style> block so no external CSS is needed. The logo is passed as a base64
 * data URL so no network requests happen during rendering.
 */

export interface ReceiptComponentItem {
    type: 'FEE_CATEGORY' | 'DISCOUNT' | 'LATE_FEE';
    feeCategoryName?: string;
    discountName?: string;
    amount: number;
}

export interface ReceiptAdjustmentItem {
    type: 'REFUND' | 'WAIVE_OFF';
    amount: number;
    paymentMethod?: string;
    adjustedAt?: string;
    reason?: string;
    createdByName?: string;
    permittedByName?: string;
}

export interface ReceiptBreakdownItem {
    name: string;
    amount: number;
}

export interface ReceiptDataForPDF {
    receiptNumber?: string;
    paymentDate?: string;
    studentName?: string;
    academicYear?: string;
    studentClass?: string;
    studentSection?: string;
    monthsPaid?: string;
    feeMonth?: string;
    paymentMethod?: string;
    components?: ReceiptComponentItem[];
    categoryBreakdown?: ReceiptBreakdownItem[];
    appliedDiscounts?: ReceiptBreakdownItem[];
    feeBreakdown?: {
        categories?: ReceiptBreakdownItem[];
        discounts?: ReceiptBreakdownItem[];
        lateFee?: number;
    };
    feeCategory?: string;
    totalBaseFee?: number;
    totalLateFee?: number;
    baseFeeAmount?: number;
    discountAmount?: number;
    otherFeeAmount?: number;
    totalPayable?: number | null;
    amountPaid: number;
    balanceAfterPayment?: number;
    balanceRemaining?: number;
    excess?: number;
    adjustments?: ReceiptAdjustmentItem[];
    collectedByName?: string;
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
    remarks?: string;
}

export interface SchoolInfoForPDF {
    name: string;
    tagline?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    /** base64 data URL: "data:image/png;base64,..." */
    logoBase64?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(str: string | undefined | null): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatINR(amount: number): string {
    return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

// ── Main template function ─────────────────────────────────────────────────

export function generateReceiptHTML(
    data: ReceiptDataForPDF,
    school: SchoolInfoForPDF,
    isAdmin: boolean,
): string {
    const monthLabel = data.monthsPaid || data.feeMonth || '—';

    // Late fee
    const lateFeeComp = data.components?.find(c => c.type === 'LATE_FEE');
    const lateFeeAmt = lateFeeComp
        ? Number(lateFeeComp.amount)
        : Number(data.totalLateFee ?? data.otherFeeAmount ?? data.feeBreakdown?.lateFee ?? 0);

    // Fee category rows
    const feeCategories: ReceiptBreakdownItem[] =
        (data.components?.filter(c => c.type === 'FEE_CATEGORY') ?? []).length > 0
            ? data.components!.filter(c => c.type === 'FEE_CATEGORY').map(c => ({
                name: c.feeCategoryName || 'Fee',
                amount: Number(c.amount),
            }))
            : data.categoryBreakdown && data.categoryBreakdown.length > 0
            ? data.categoryBreakdown
            : data.feeBreakdown?.categories && data.feeBreakdown.categories.length > 0
            ? data.feeBreakdown.categories
            : (data.baseFeeAmount ?? data.totalBaseFee ?? 0) > 0
            ? [{ name: `Base Tuition${data.feeCategory ? ` / ${data.feeCategory} Fee` : ''}`, amount: Number(data.baseFeeAmount ?? data.totalBaseFee) }]
            : [];

    // Discount rows
    const discountRows: ReceiptBreakdownItem[] =
        (data.components?.filter(c => c.type === 'DISCOUNT') ?? []).length > 0
            ? data.components!.filter(c => c.type === 'DISCOUNT').map(c => ({
                name: c.discountName || 'Discount',
                amount: Number(c.amount),
            }))
            : data.appliedDiscounts && data.appliedDiscounts.length > 0
            ? data.appliedDiscounts
            : data.feeBreakdown?.discounts && data.feeBreakdown.discounts.length > 0
            ? data.feeBreakdown.discounts
            : !data.feeBreakdown?.discounts && (data.discountAmount ?? 0) > 0
            ? [{ name: 'Discount', amount: Number(data.discountAmount) }]
            : [];

    const balanceDue = data.balanceAfterPayment ?? data.balanceRemaining ?? 0;
    const refunds = (data.adjustments ?? []).filter(a => a.type === 'REFUND');
    const waiveOffs = (data.adjustments ?? []).filter(a => a.type === 'WAIVE_OFF');

    // ── Build table rows ────────────────────────────────────────────────────

    const categoryRowsHTML = feeCategories.map(c => `
          <tr>
            <td class="td-left">${esc(c.name)}</td>
            <td class="td-right">&#x20B9;${formatINR(c.amount)}</td>
          </tr>`).join('');

    const discountRowsHTML = discountRows.map(d => `
          <tr class="row-discount">
            <td class="td-left">Discount (${esc(d.name)})</td>
            <td class="td-right">-&#x20B9;${formatINR(d.amount)}</td>
          </tr>`).join('');

    const lateFeeHTML = lateFeeAmt > 0 ? `
          <tr class="row-late">
            <td class="td-left">Late Fee</td>
            <td class="td-right">+&#x20B9;${formatINR(lateFeeAmt)}</td>
          </tr>` : '';

    const totalPayableHTML = data.totalPayable != null ? `
          <tr class="row-total-payable">
            <td class="td-left">Total Payable</td>
            <td class="td-right">&#x20B9;${formatINR(Number(data.totalPayable))}</td>
          </tr>` : '';

    const totalPaidHTML = `
          <tr class="row-paid">
            <td class="td-left td-paid-label"><span class="check-icon">&#10003;</span> Total Paid</td>
            <td class="td-right td-paid-amt">&#x20B9;${formatINR(Number(data.amountPaid))}</td>
          </tr>`;

    const refundsHTML = refunds.map(a => `
          <tr class="row-refund">
            <td class="td-left">
              Refund (${esc(a.paymentMethod || '—')})
              ${a.adjustedAt ? `<span class="meta-date">${formatDate(a.adjustedAt)}</span>` : ''}
              ${a.reason ? `<span class="meta-note">${esc(a.reason)}</span>` : ''}
              ${a.createdByName ? `<span class="meta-note">Refunded by: ${esc(a.createdByName)}</span>` : ''}
            </td>
            <td class="td-right">-&#x20B9;${formatINR(Number(a.amount))}</td>
          </tr>`).join('');

    const waiveOffsHTML = waiveOffs.map(a => `
          <tr class="row-waive">
            <td class="td-left">
              Fee Waived Off
              ${a.adjustedAt ? `<span class="meta-date">${formatDate(a.adjustedAt)}</span>` : ''}
              ${a.reason ? `<span class="meta-note">${esc(a.reason)}</span>` : ''}
              ${a.createdByName ? `<span class="meta-note">Waived by: ${esc(a.createdByName)}</span>` : ''}
              ${a.permittedByName ? `<span class="meta-note">Permitted by: ${esc(a.permittedByName)}</span>` : ''}
            </td>
            <td class="td-right">-&#x20B9;${formatINR(Number(a.amount))}</td>
          </tr>`).join('');

    const excessHTML = (data.excess ?? 0) > 0 ? `
          <tr class="row-excess">
            <td class="td-left">Excess Balance</td>
            <td class="td-right">&#x20B9;${formatINR(Number(data.excess))}</td>
          </tr>` : '';

    const balanceHTML = balanceDue > 0 ? `
          <tr class="row-balance">
            <td class="td-left">Balance Remaining</td>
            <td class="td-right">&#x20B9;${formatINR(Number(balanceDue))}</td>
          </tr>` : '';

    // ── Misc sections ────────────────────────────────────────────────────────

    const collectedByHTML = data.collectedByName
        ? `<div class="info-row"><span class="info-label">Collected by:</span><span class="info-value">${esc(data.collectedByName)}</span></div>`
        : data.gatewayPaymentId
        ? `<div class="info-row"><span class="info-label">Processed via:</span><span class="info-value">Razorpay</span></div>`
        : '';

    const gatewayHTML = data.gatewayPaymentId ? `
        <div class="gateway-box">
          <p class="gateway-label">Gateway Transaction ID</p>
          <p class="gateway-id">${esc(data.gatewayPaymentId)}</p>
          ${data.gatewayOrderId ? `<p class="gateway-order">Order: ${esc(data.gatewayOrderId)}</p>` : ''}
        </div>` : '';

    const remarksHTML = data.remarks
        ? `<p class="remarks">Remarks: ${esc(data.remarks)}</p>`
        : '';

    const studentDetailHTML = data.studentName ? `
        <div class="meta-card full-width">
          <div class="meta-icon icon-blue">&#128100;</div>
          <div class="meta-content">
            <p class="meta-label">Student Details</p>
            <div class="student-row">
              <span class="student-name">${esc(data.studentName)}</span>
              <span class="student-class">${esc([data.studentClass, data.studentSection].filter(Boolean).join(' \u2013 '))}</span>
            </div>
          </div>
        </div>` : '';

    const footerLeftHTML = isAdmin
        ? `<div class="sig-box"><div class="sig-line"></div><span class="sig-label">Authorized Signature</span></div>`
        : `<span class="digital-notice">This is a digitally generated receipt and does not require a signature.</span>`;

    const logoHTML = school.logoBase64
        ? `<img src="${school.logoBase64}" alt="${esc(school.name)}" class="school-logo" />`
        : '';

    const contactHTML = (school.phone || school.email || school.website) ? `
        <div class="contact-row">
          ${school.phone ? `<span>&#128222; ${esc(school.phone)}</span>` : ''}
          ${school.email ? `<span>&#9993; ${esc(school.email)}</span>` : ''}
          ${school.website ? `<span>&#127760; ${esc((school.website || '').replace(/^https?:\/\//, ''))}</span>` : ''}
        </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 148mm;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #334155;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .header {
      background: #0f172a;
      border-bottom: 4px solid #10b981;
      padding: 18px 22px;
      text-align: center;
      color: white;
    }
    .school-logo {
      height: 50px;
      max-width: 120px;
      object-fit: contain;
      display: block;
      margin: 0 auto 8px;
    }
    .school-name { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; color: #fff; }
    .school-tagline { font-size: 10px; color: #cbd5e1; font-style: italic; margin-top: 2px; }
    .school-address { font-size: 10px; color: #94a3b8; margin-top: 3px; line-height: 1.4; }
    .contact-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; }
    .contact-row span { font-size: 10px; color: #94a3b8; }
    .receipt-label {
      font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
      font-weight: 700; color: #6ee7b7; margin-top: 10px;
    }

    /* ── Body ── */
    .body { padding: 14px 18px; background: #f8fafc; }

    /* ── Meta grid ── */
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .meta-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px;
    }
    .meta-card.full-width { grid-column: 1 / -1; }
    .meta-card.right-aligned { flex-direction: row-reverse; text-align: right; }
    .meta-icon {
      width: 26px; height: 26px; border-radius: 6px; display: flex;
      align-items: center; justify-content: center; font-size: 13px;
      flex-shrink: 0; background: #f1f5f9;
    }
    .icon-blue { background: #eff6ff; }
    .icon-green { background: #f0fdf4; }
    .meta-content { flex: 1; min-width: 0; }
    .meta-label {
      font-size: 9px; text-transform: uppercase; font-weight: 700;
      letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 2px;
    }
    .meta-value {
      font-size: 12px; font-weight: 700; color: #1e293b;
      word-break: break-all; font-family: 'Courier New', monospace;
    }
    .meta-value.normal { font-family: inherit; }
    .student-row { display: flex; justify-content: space-between; align-items: flex-end; }
    .student-name { font-size: 13px; font-weight: 800; color: #1e293b; }
    .student-class { font-size: 10px; color: #64748b; }
    .payment-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px;
      padding: 2px 8px; font-size: 10px; font-weight: 600; color: #475569;
    }

    /* ── Table ── */
    .table-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 8px;
      overflow: hidden; margin-bottom: 12px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    thead th {
      padding: 7px 12px; font-size: 9px; text-transform: uppercase;
      font-weight: 700; letter-spacing: 0.8px; color: #64748b;
    }
    thead th:last-child { text-align: right; }
    tr { border-bottom: 1px solid #f1f5f9; }
    tr:last-child { border-bottom: none; }
    .td-left { padding: 7px 6px 7px 12px; vertical-align: top; }
    .td-right { padding: 7px 12px 7px 6px; text-align: right; white-space: nowrap; vertical-align: top; }
    .row-discount td { color: #16a34a; }
    .row-late td { color: #dc2626; }
    .row-total-payable td { color: #475569; font-size: 10.5px; }
    .row-paid { background: #f0fdf4; border-top: 2px solid #e2e8f0 !important; }
    .td-paid-label { font-weight: 800; color: #1e293b; }
    .td-paid-amt { font-weight: 800; font-size: 13px; color: #047857; }
    .check-icon { color: #10b981; margin-right: 4px; }
    .row-refund td { color: #ea580c; }
    .row-waive td { color: #9333ea; }
    .row-excess td { color: #16a34a; font-weight: 600; }
    .row-balance td { color: #dc2626; font-weight: 600; }
    .meta-date { display: inline; margin-left: 4px; font-size: 9px; color: #94a3b8; }
    .meta-note { display: block; font-size: 9px; color: #94a3b8; margin-top: 1px; }

    /* ── Info / Gateway ── */
    .info-row {
      display: flex; justify-content: space-between; font-size: 10px; color: #64748b;
      border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;
    }
    .info-value { font-weight: 600; color: #1e293b; }
    .gateway-box {
      margin-top: 8px; border: 1px solid #bfdbfe;
      background: #eff6ff; border-radius: 6px; padding: 6px 10px;
    }
    .gateway-label { font-size: 9px; color: #64748b; margin-bottom: 2px; }
    .gateway-id {
      font-family: 'Courier New', monospace; color: #1d4ed8;
      word-break: break-all; font-size: 10px;
    }
    .gateway-order {
      font-size: 9px; color: #94a3b8; margin-top: 2px;
      font-family: 'Courier New', monospace; word-break: break-all;
    }
    .remarks { margin-top: 8px; font-size: 10px; color: #64748b; }

    /* ── Footer ── */
    .footer {
      margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
    }
    .digital-notice {
      font-size: 9.5px; font-style: italic; background: #eff6ff; color: #1d4ed8;
      padding: 5px 10px; border-radius: 6px; border: 1px solid #bfdbfe;
      flex: 1; min-width: 0;
    }
    .sig-box { text-align: center; }
    .sig-line { width: 90px; border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 2px; }
    .sig-label { font-size: 9px; font-weight: 600; color: #64748b; }
    .thank-you {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 2px; color: #94a3b8; flex-shrink: 0;
    }

    /* ── PAID watermark ── */
    .watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 96px; font-weight: 900; color: #10b981;
      opacity: 0.03; letter-spacing: 8px; pointer-events: none;
      z-index: 0; white-space: nowrap;
    }
  </style>
</head>
<body>

  <div class="watermark">PAID</div>

  <!-- ── Header ── -->
  <div class="header">
    ${logoHTML}
    <div class="school-name">${esc(school.name)}</div>
    ${school.tagline ? `<div class="school-tagline">${esc(school.tagline)}</div>` : ''}
    ${school.address ? `<div class="school-address">&#128205; ${esc(school.address)}</div>` : ''}
    ${contactHTML}
    <div class="receipt-label">Official Fee Receipt</div>
  </div>

  <!-- ── Body ── -->
  <div class="body">

    <!-- Meta cards -->
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-icon">#</div>
        <div class="meta-content">
          <p class="meta-label">Receipt No.</p>
          <p class="meta-value">${esc(data.receiptNumber || '—')}</p>
        </div>
      </div>

      <div class="meta-card right-aligned">
        <div class="meta-icon icon-green">&#128197;</div>
        <div class="meta-content">
          <p class="meta-label">Date</p>
          <p class="meta-value normal">${formatDate(data.paymentDate)}</p>
        </div>
      </div>

      ${studentDetailHTML}

      <div class="meta-card full-width" style="justify-content:space-between;align-items:center;">
        <div>
          <p class="meta-label">Fee Month(s)</p>
          <p class="meta-value normal">${esc(monthLabel)}</p>
        </div>
        ${data.paymentMethod ? `
        <div style="text-align:right;">
          <p class="meta-label">Payment Method</p>
          <span class="payment-badge">&#128179; ${esc(data.paymentMethod)}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Breakdown table -->
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRowsHTML}
          ${discountRowsHTML}
          ${lateFeeHTML}
          ${totalPayableHTML}
          ${totalPaidHTML}
          ${refundsHTML}
          ${waiveOffsHTML}
          ${excessHTML}
          ${balanceHTML}
        </tbody>
      </table>
    </div>

    ${collectedByHTML}
    ${gatewayHTML}
    ${remarksHTML}

    <!-- Footer -->
    <div class="footer">
      ${footerLeftHTML}
      <span class="thank-you">Thank You</span>
    </div>

  </div>

</body>
</html>`;
}
