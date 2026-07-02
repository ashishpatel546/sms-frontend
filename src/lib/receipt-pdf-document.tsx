/**
 * receipt-pdf-document.tsx
 *
 * Renders the fee receipt as a @react-pdf/renderer Document.
 * Pure JS / no Chromium – generates a PDF buffer in ~200-400 ms.
 *
 * Font notes:
 *  • NS  (NotoSans Latin)      covers A-Z, 0-9, common punctuation
 *  • NSX (NotoSans Latin-Ext)  covers ₹ (U+20B9)
 *  Uses .woff format (not .woff2) for reliable fontkit support.
 *  Both shipped locally via @fontsource/noto-sans – no internet dependency.
 */

import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    Image,
    StyleSheet,
    Font,
    renderToBuffer,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import path from 'path';
import type { ReceiptDataForPDF, SchoolInfoForPDF } from './receipt-html-template';

// ── Font registration (once per process) ─────────────────────────────────
const _fd = path.join(
    process.cwd(),
    'node_modules', '@fontsource', 'noto-sans', 'files',
).split(path.sep).join('/'); // forward slashes for react-pdf

Font.register({
    family: 'NS',
    fonts: [
        { src: `${_fd}/noto-sans-latin-400-normal.woff`, fontWeight: 400, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-700-normal.woff`, fontWeight: 700, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-400-italic.woff`, fontWeight: 400, fontStyle: 'italic' },
        { src: `${_fd}/noto-sans-latin-700-italic.woff`, fontWeight: 700, fontStyle: 'italic' },
    ],
});

// NSX covers ₹ glyph (U+20B9 is in the latin-ext subset)
Font.register({
    family: 'NSX',
    fonts: [
        { src: `${_fd}/noto-sans-latin-ext-400-normal.woff`, fontWeight: 400, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-ext-700-normal.woff`, fontWeight: 700, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-ext-400-italic.woff`, fontWeight: 400, fontStyle: 'italic' },
        { src: `${_fd}/noto-sans-latin-ext-700-italic.woff`, fontWeight: 700, fontStyle: 'italic' },
    ],
});

Font.registerHyphenationCallback((w) => [w]);

// ── Helpers ───────────────────────────────────────────────────────────────
function inr(n: number): string {
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
    if (!d) return '\u2014';
    try {
        return new Date(d).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch { return d; }
}

// ── Theme ─────────────────────────────────────────────────────────────────
const C = {
    dark:   '#0f172a',
    green:  '#10b981',
    lgr:    '#6ee7b7',
    grBg:   '#f0fdf4',
    text:   '#334155',
    dk:     '#1e293b',
    mt:     '#64748b',
    lt:     '#94a3b8',
    br:     '#e2e8f0',
    bg:     '#f8fafc',
    disc:   '#16a34a',
    red:    '#dc2626',
    blue:   '#1d4ed8',
    blueBg: '#eff6ff',
    blueBr: '#bfdbfe',
    org:    '#ea580c',
    pur:    '#9333ea',
} as const;

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    // Page
    page: { fontFamily: 'NS', fontSize: 8, color: C.text, backgroundColor: 'white' },

    // Header
    hdr: {
        backgroundColor: C.dark,
        borderBottomWidth: 3, borderBottomColor: C.green,
        paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        alignItems: 'center',
    },
    // Logo: fixed dimensions; no objectFit/maxWidth (not react-pdf props)
    logo: { height: 34, width: 80, marginBottom: 5 },
    schoolName: { fontSize: 12, fontWeight: 700, color: 'white', textAlign: 'center' },
    tagline:    { fontSize: 7, color: '#cbd5e1', fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
    addr:       { fontSize: 7, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
    ctRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 3 },
    ctTxt: { fontSize: 7, color: '#94a3b8', marginLeft: 6, marginRight: 6 },
    rcpLabel: { fontSize: 6.5, letterSpacing: 2, fontWeight: 700, color: C.lgr, marginTop: 8, textTransform: 'uppercase' as const },

    // Body
    body: { padding: 10, backgroundColor: C.bg, flex: 1 },

    // Meta cards
    metaRow: { flexDirection: 'row', marginBottom: 6 },
    card: {
        backgroundColor: 'white', borderWidth: 1, borderColor: C.br, borderRadius: 6,
        paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, flex: 1,
        marginRight: 6,
    },
    cardLast: { marginRight: 0 },
    lbl: { fontSize: 6, textTransform: 'uppercase' as const, fontWeight: 700, letterSpacing: 0.8, color: C.lt, marginBottom: 3 },
    val: { fontSize: 9, fontWeight: 700, color: C.dk },
    valN: { fontWeight: 400 },
    sRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sName: { fontSize: 9, fontWeight: 700, color: C.dk },
    sCls: { fontSize: 7, color: C.mt },
    badge: {
        flexDirection: 'row', backgroundColor: '#f1f5f9',
        borderWidth: 1, borderColor: C.br, borderRadius: 99,
        paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6,
    },
    badgeTxt: { fontSize: 7, fontWeight: 700, color: '#475569' },

    // Breakdown table – no overflow:hidden (not supported)
    tblCard: {
        backgroundColor: 'white', borderWidth: 1, borderColor: C.br,
        borderRadius: 6, marginBottom: 8,
    },
    tblHdr: {
        backgroundColor: C.bg, flexDirection: 'row',
        borderBottomWidth: 1, borderBottomColor: C.br,
        paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10,
    },
    tblHdrTxt: { fontSize: 6.5, textTransform: 'uppercase' as const, fontWeight: 700, letterSpacing: 0.8, color: C.mt },
    tblRow: {
        flexDirection: 'row',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
        paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10,
        alignItems: 'flex-start',
    },
    tblRowLast: { borderBottomWidth: 0 },
    tblRowPaid: { backgroundColor: C.grBg, borderTopWidth: 1.5, borderTopColor: C.br },
    cDesc: { flex: 1, paddingRight: 4 },
    cAmt:  { width: 60, textAlign: 'right' as const },
    metaNote: { fontSize: 6.5, color: C.lt, marginTop: 1 },

    // Info / gateway
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: C.br, paddingTop: 6, marginTop: 6,
    },
    infoTxt: { fontSize: 7.5, color: C.mt },
    infoVal: { fontSize: 7.5, fontWeight: 700, color: C.dk },
    gwBox:   { marginTop: 6, borderWidth: 1, borderColor: C.blueBr, backgroundColor: C.blueBg, borderRadius: 5, padding: 6 },
    gwLbl:   { fontSize: 6.5, color: C.mt, marginBottom: 2 },
    gwId:    { color: C.blue, fontSize: 7.5 },
    gwOrd:   { fontSize: 6.5, color: C.lt, marginTop: 2 },
    remarks: { marginTop: 6, fontSize: 7.5, color: C.mt },

    // Footer
    footer: {
        marginTop: 10, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: C.br,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    notice: {
        fontSize: 7, fontStyle: 'italic',
        backgroundColor: C.blueBg, color: C.blue,
        padding: 5, borderRadius: 5, borderWidth: 1, borderColor: C.blueBr, flex: 1,
        marginRight: 10,
    },
    sigBox: { alignItems: 'center' },
    sigLine: { width: 65, borderBottomWidth: 1, borderBottomColor: C.lt, height: 16, marginBottom: 2 },
    sigLbl:  { fontSize: 6.5, fontWeight: 700, color: C.mt },
    thankYou: { fontSize: 6, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 2, color: C.lt },

    // Watermark – uses absolute positioning; rotate via transform string
    wm: {
        position: 'absolute', top: 180, left: 20,
        fontSize: 70, fontWeight: 700, color: C.green, opacity: 0.04,
        letterSpacing: 8, transform: 'rotate(-30deg)',
    },
});

// ── Amount component ──────────────────────────────────────────────────────
// Renders ₹ using NSX (covers U+20B9) + amount digits using NS.
interface AmtProps {
    n: number;
    fw?: 400 | 700;
    color?: string;
    prefix?: string;
}
function Amt({ n, fw = 400, color, prefix }: AmtProps) {
    return (
        <Text style={[s.cAmt, { fontWeight: fw, color }]}>
            {prefix ?? ''}
            <Text style={{ fontFamily: 'NSX', fontWeight: fw }}>{'\u20B9'}</Text>
            {inr(n)}
        </Text>
    );
}

// ── Receipt Document ──────────────────────────────────────────────────────
interface Props { data: ReceiptDataForPDF; school: SchoolInfoForPDF; isAdmin: boolean; }

function ReceiptDocument({ data, school, isAdmin }: Props) {
    const monthLabel = data.monthsPaid || data.feeMonth || '\u2014';

    // Late fee
    const lateFeeComp = data.components?.find(c => c.type === 'LATE_FEE');
    const lateFeeAmt = lateFeeComp
        ? Number(lateFeeComp.amount)
        : Number(data.totalLateFee ?? data.otherFeeAmount ?? data.feeBreakdown?.lateFee ?? 0);

    // Fee category rows
    const feeCategories: Array<{ name: string; amount: number }> =
        (data.components?.filter(c => c.type === 'FEE_CATEGORY') ?? []).length > 0
            ? data.components!.filter(c => c.type === 'FEE_CATEGORY')
                .map(c => ({ name: c.feeCategoryName || 'Fee', amount: Number(c.amount) }))
            : data.categoryBreakdown?.length
                ? data.categoryBreakdown
                : data.feeBreakdown?.categories?.length
                    ? data.feeBreakdown.categories
                    : (data.baseFeeAmount ?? data.totalBaseFee ?? 0) > 0
                        ? [{
                            name: `Base Tuition${data.feeCategory ? ` / ${data.feeCategory} Fee` : ''}`,
                            amount: Number(data.baseFeeAmount ?? data.totalBaseFee),
                        }]
                        : [];

    // Discount rows
    const discountRows: Array<{ name: string; amount: number }> =
        (data.components?.filter(c => c.type === 'DISCOUNT') ?? []).length > 0
            ? data.components!.filter(c => c.type === 'DISCOUNT')
                .map(c => ({ name: c.discountName || 'Discount', amount: Number(c.amount) }))
            : data.appliedDiscounts?.length
                ? data.appliedDiscounts
                : data.feeBreakdown?.discounts?.length
                    ? data.feeBreakdown.discounts
                    : (data.discountAmount ?? 0) > 0
                        ? [{ name: 'Discount', amount: Number(data.discountAmount) }]
                        : [];

    const balanceDue = data.balanceAfterPayment ?? data.balanceRemaining ?? 0;
    const refunds    = (data.adjustments ?? []).filter(a => a.type === 'REFUND');
    const waiveOffs  = (data.adjustments ?? []).filter(a => a.type === 'WAIVE_OFF');

    // ── Build rows ────────────────────────────────────────────────────────
    interface RowItem { key: string; desc: React.ReactNode; amt: React.ReactNode; rowStyle?: object; }
    const rows: RowItem[] = [];

    feeCategories.forEach((c, i) => rows.push({
        key: `fc${i}`,
        desc: <Text style={s.cDesc}>{c.name}</Text>,
        amt:  <Amt n={c.amount} />,
    }));

    discountRows.forEach((d, i) => rows.push({
        key: `dc${i}`,
        desc: <Text style={[s.cDesc, { color: C.disc }]}>Discount ({d.name})</Text>,
        amt:  <Amt n={d.amount} color={C.disc} prefix="-" />,
    }));

    if (lateFeeAmt > 0) rows.push({
        key: 'lf',
        desc: <Text style={[s.cDesc, { color: C.red }]}>Late Fee</Text>,
        amt:  <Amt n={lateFeeAmt} color={C.red} prefix="+" />,
    });

    if (data.totalPayable != null) rows.push({
        key: 'tp',
        desc: <Text style={[s.cDesc, { color: C.mt }]}>Total Payable</Text>,
        amt:  <Amt n={Number(data.totalPayable)} color={C.mt} />,
    });

    rows.push({
        key: 'paid',
        rowStyle: s.tblRowPaid,
        desc: <Text style={[s.cDesc, { fontWeight: 700, color: '#047857' }]}>Total Paid</Text>,
        amt:  <Amt n={Number(data.amountPaid)} fw={700} color="#047857" />,
    });

    refunds.forEach((a, i) => rows.push({
        key: `rf${i}`,
        desc: (
            <View style={s.cDesc}>
                <Text style={{ color: C.org }}>Refund ({a.paymentMethod || '\u2014'})</Text>
                {a.adjustedAt    && <Text style={s.metaNote}>{fmtDate(a.adjustedAt)}</Text>}
                {a.reason        && <Text style={s.metaNote}>{a.reason}</Text>}
                {a.createdByName && <Text style={s.metaNote}>Refunded by: {a.createdByName}</Text>}
            </View>
        ),
        amt: <Amt n={Number(a.amount)} color={C.org} prefix="-" />,
    }));

    waiveOffs.forEach((a, i) => rows.push({
        key: `wo${i}`,
        desc: (
            <View style={s.cDesc}>
                <Text style={{ color: C.pur }}>Fee Waived Off</Text>
                {a.adjustedAt      && <Text style={s.metaNote}>{fmtDate(a.adjustedAt)}</Text>}
                {a.reason          && <Text style={s.metaNote}>{a.reason}</Text>}
                {a.createdByName   && <Text style={s.metaNote}>Waived by: {a.createdByName}</Text>}
                {a.permittedByName && <Text style={s.metaNote}>Permitted by: {a.permittedByName}</Text>}
            </View>
        ),
        amt: <Amt n={Number(a.amount)} color={C.pur} prefix="-" />,
    }));

    if ((data.excess ?? 0) > 0) rows.push({
        key: 'exc',
        desc: <Text style={[s.cDesc, { fontWeight: 700, color: C.disc }]}>Excess Balance</Text>,
        amt:  <Amt n={Number(data.excess)} fw={700} color={C.disc} />,
    });

    if (balanceDue > 0) rows.push({
        key: 'bal',
        desc: <Text style={[s.cDesc, { fontWeight: 700, color: C.red }]}>Balance Remaining</Text>,
        amt:  <Amt n={balanceDue} fw={700} color={C.red} />,
    });

    return (
        <Document>
            <Page size="A5" style={s.page}>

                {/* PAID watermark – absolute so it doesn't affect layout */}
                <Text style={s.wm}>PAID</Text>

                {/* ── Header ── */}
                <View style={s.hdr}>
                    {school.logoBase64 && <Image src={school.logoBase64} style={s.logo} />}
                    <Text style={s.schoolName}>{school.name}</Text>
                    {school.tagline && <Text style={s.tagline}>{school.tagline}</Text>}
                    {school.address && <Text style={s.addr}>{school.address}</Text>}
                    {(school.phone || school.email || school.website) && (
                        <View style={s.ctRow}>
                            {school.phone   && <Text style={s.ctTxt}>{school.phone}</Text>}
                            {school.email   && <Text style={s.ctTxt}>{school.email}</Text>}
                            {school.website && (
                                <Text style={s.ctTxt}>
                                    {school.website.replace(/^https?:\/\//, '')}
                                </Text>
                            )}
                        </View>
                    )}
                    <Text style={s.rcpLabel}>Official Fee Receipt</Text>
                </View>

                {/* ── Body ── */}
                <View style={s.body}>

                    {/* Receipt # + Date */}
                    <View style={s.metaRow}>
                        <View style={s.card}>
                            <Text style={s.lbl}>Receipt No.</Text>
                            <Text style={s.val}>{data.receiptNumber || '\u2014'}</Text>
                        </View>
                        <View style={[s.card, s.cardLast]}>
                            <Text style={s.lbl}>Date</Text>
                            <Text style={[s.val, s.valN]}>{fmtDate(data.paymentDate)}</Text>
                        </View>
                    </View>

                    {/* Student details */}
                    {data.studentName && (
                        <View style={s.metaRow}>
                            <View style={[s.card, s.cardLast]}>
                                <Text style={s.lbl}>Student Details</Text>
                                <View style={s.sRow}>
                                    <Text style={s.sName}>{data.studentName}</Text>
                                    <Text style={s.sCls}>
                                        {[data.studentClass, data.studentSection].filter(Boolean).join(' \u2013 ')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Fee month + payment method */}
                    <View style={[s.metaRow, { marginBottom: 10 }]}>
                        <View style={[s.card, s.cardLast, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                            <View>
                                <Text style={s.lbl}>Fee Month(s)</Text>
                                <Text style={[s.val, s.valN]}>{monthLabel}</Text>
                            </View>
                            {data.paymentMethod && (
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.lbl, { marginBottom: 4 }]}>Payment Method</Text>
                                    <View style={s.badge}>
                                        <Text style={s.badgeTxt}>{data.paymentMethod}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── Breakdown table ── */}
                    <View style={s.tblCard}>
                        <View style={s.tblHdr}>
                            <Text style={[s.tblHdrTxt, { flex: 1 }]}>Description</Text>
                            <Text style={[s.tblHdrTxt, { width: 60, textAlign: 'right' }]}>Amount</Text>
                        </View>
                        {rows.map((row, idx) => (
                            <View
                                key={row.key}
                                style={[
                                    s.tblRow,
                                    (row.rowStyle ?? {}) as Style,
                                    (idx === rows.length - 1 ? s.tblRowLast : {}) as Style,
                                ]}
                            >
                                {row.desc}
                                {row.amt}
                            </View>
                        ))}
                    </View>

                    {/* Collected by / gateway */}
                    {(data.collectedByName || data.gatewayPaymentId) && (
                        <View style={s.infoRow}>
                            <Text style={s.infoTxt}>
                                {data.collectedByName ? 'Collected by:' : 'Processed via:'}
                            </Text>
                            <Text style={s.infoVal}>{data.collectedByName ?? 'Razorpay'}</Text>
                        </View>
                    )}

                    {data.gatewayPaymentId && (
                        <View style={s.gwBox}>
                            <Text style={s.gwLbl}>Gateway Transaction ID</Text>
                            <Text style={s.gwId}>{data.gatewayPaymentId}</Text>
                            {data.gatewayOrderId && (
                                <Text style={s.gwOrd}>Order: {data.gatewayOrderId}</Text>
                            )}
                        </View>
                    )}

                    {data.remarks && (
                        <Text style={s.remarks}>Remarks: {data.remarks}</Text>
                    )}

                    {/* ── Footer ── */}
                    <View style={s.footer}>
                        {isAdmin ? (
                            <View style={[s.sigBox, { marginRight: 10 }]}>
                                <View style={s.sigLine} />
                                <Text style={s.sigLbl}>Authorized Signature</Text>
                            </View>
                        ) : (
                            <Text style={s.notice}>
                                This is a digitally generated receipt and does not require a signature.
                            </Text>
                        )}
                        <Text style={s.thankYou}>Thank You</Text>
                    </View>

                </View>
            </Page>
        </Document>
    );
}

// ── Public API ────────────────────────────────────────────────────────────
export async function renderReceiptPDF(
    data: ReceiptDataForPDF,
    school: SchoolInfoForPDF,
    isAdmin: boolean,
): Promise<Buffer> {
    return renderToBuffer(
        <ReceiptDocument data={data} school={school} isAdmin={isAdmin} />,
    );
}

