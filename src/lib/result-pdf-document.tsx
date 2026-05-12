/**
 * result-pdf-document.tsx
 *
 * Renders a student Examination Result Card as a @react-pdf/renderer Document.
 * Pure JS / no Chromium – generates a PDF buffer in ~200-500 ms.
 *
 * Design goals:
 *  • Clean, elegant layout that looks great on both colour and B&W printouts.
 *  • All text and school info centred in the header.
 *  • One exam category per page — no category ever splits across pages.
 *  • Simple border-based table (no colour-filled cells) for B&W compatibility.
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
import path from 'path';

// ── Font registration ─────────────────────────────────────────────────────
const _fd = path.join(
    process.cwd(),
    'node_modules', '@fontsource', 'noto-sans', 'files',
).split(path.sep).join('/');

Font.register({
    family: 'NS',
    fonts: [
        { src: `${_fd}/noto-sans-latin-400-normal.woff`, fontWeight: 400, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-700-normal.woff`, fontWeight: 700, fontStyle: 'normal' },
        { src: `${_fd}/noto-sans-latin-400-italic.woff`, fontWeight: 400, fontStyle: 'italic' },
        { src: `${_fd}/noto-sans-latin-700-italic.woff`, fontWeight: 700, fontStyle: 'italic' },
    ],
});

Font.registerHyphenationCallback((w) => [w]);

// ── Public types ──────────────────────────────────────────────────────────

export interface SubjectMarkForPDF {
    subjectName: string;
    hasTheory: boolean;
    hasPractical: boolean;
    theoryTotal: number | null;
    theoryObtained: number | null;
    practicalTotal: number | null;
    practicalObtained: number | null;
    totalMarks: number | null;
    obtainedMarks: number | null;
    percentage: number | null;
    grade: string | null;
    isPass: boolean | null;
}

export interface CategoryResultForPDF {
    categoryName: string;
    subjects: SubjectMarkForPDF[];
    sumTotal: number;
    sumObtained: number;
    overallPercentage: number | null;
    overallGrade: string | null;
    overallPass: boolean | null;
}

export interface ResultDataForPDF {
    studentName: string;
    className: string;
    sectionName: string;
    rollNo?: string | null;
    admissionNo?: string | null;
    sessionLabel: string;
    categories: CategoryResultForPDF[];
    generatedAt: string;
}

export interface SchoolInfoForResultPDF {
    name: string;
    tagline?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    /** base64 data URL: "data:image/png;base64,..." */
    logoBase64?: string | null;
}

// ── Styles ────────────────────────────────────────────────────────────────
// Design goals:
//   • Works beautifully on B&W printouts — no colour-filled cells, only borders.
//   • Header content is centred via textAlign:'center' on Text + alignItems:'center'
//     on the logo wrapper View (keeping Text elements full-width so centering works).
//   • One Page per exam category so a category never splits across pages.

const s = StyleSheet.create({
    // ── Page ──────────────────────────────────────────────────────────────
    page: {
        fontFamily: 'NS',
        fontSize: 9,
        color: '#111',
        backgroundColor: 'white',
        paddingBottom: 28,   // space for fixed footer
    },

    // ── Header ─────────────────────────────────────────────────────────────
    // Key: do NOT use alignItems:'center' on the outer View — it shrinks Text
    // children to content-width and breaks textAlign:'center'. Instead wrap the
    // logo in its own centred View and let Text span full width.
    hdr: {
        paddingTop: 16,
        paddingBottom: 14,
        paddingLeft: 24,
        paddingRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: '#111',
    },
    logoWrap: {
        alignItems: 'center',   // only the Image needs flex-shrink
        marginBottom: 6,
    },
    logo:       { height: 44, width: 100 },
    schoolName: { fontSize: 15, fontWeight: 700, color: '#000', textAlign: 'center', marginBottom: 2 },
    tagline:    { fontSize: 8, color: '#444', fontStyle: 'italic', textAlign: 'center', marginBottom: 2 },
    addr:       { fontSize: 8, color: '#444', textAlign: 'center', marginBottom: 1 },
    ctTxt:      { fontSize: 7.5, color: '#555', textAlign: 'center' },
    cardLabel:  {
        fontSize: 10, fontWeight: 700, color: '#000',
        textAlign: 'center', letterSpacing: 2,
        marginTop: 10, marginBottom: 0,
        textTransform: 'uppercase' as const,
    },
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: '#bbb',
        marginTop: 6,
    },

    // ── Body ───────────────────────────────────────────────────────────────
    body: {
        paddingTop: 10,
        paddingLeft: 24,
        paddingRight: 24,
    },

    // ── Student info ────────────────────────────────────────────────────────
    studentBox: {
        borderWidth: 1,
        borderColor: '#aaa',
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        marginBottom: 14,
    },
    studentBoxTitle: {
        fontSize: 6.5,
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
        color: '#666',
        textAlign: 'center',
        marginBottom: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ccc',
        paddingBottom: 4,
    },
    studentName: {
        fontSize: 13,
        fontWeight: 700,
        color: '#000',
        textAlign: 'center',
        marginBottom: 6,
    },
    studentMetaRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    metaPair:  { marginLeft: 10, marginRight: 10, alignItems: 'center' },
    metaLbl:   { fontSize: 6, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.4, textAlign: 'center' },
    metaVal:   { fontSize: 8.5, fontWeight: 700, color: '#000', textAlign: 'center' },

    // ── Category section ────────────────────────────────────────────────────
    catTitle: {
        fontSize: 9,
        fontWeight: 700,
        color: '#000',
        textTransform: 'uppercase' as const,
        letterSpacing: 1.2,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#111',
        paddingTop: 5,
        paddingBottom: 5,
        marginBottom: 0,
    },

    // ── Marks table ─────────────────────────────────────────────────────────
    tbl:     { borderWidth: 1, borderColor: '#aaa', borderTopWidth: 0 },
    tblHdr:  {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#aaa',
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6,
        backgroundColor: '#eeeeee',   // light grey — prints as grey in B&W
    },
    tblRow:  {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#ddd',
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6,
        alignItems: 'center',
    },
    tblFooter: {
        flexDirection: 'row',
        borderTopWidth: 1.5,
        borderTopColor: '#aaa',
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 6,
        paddingRight: 6,
        backgroundColor: '#f4f4f4',
        alignItems: 'center',
    },
    tblHdrTxt:   { fontSize: 7, fontWeight: 700, color: '#333', textTransform: 'uppercase' as const, letterSpacing: 0.3 },
    tblCell:     { fontSize: 8, color: '#111' },
    tblCellBold: { fontSize: 8, fontWeight: 700, color: '#000' },

    // ── Column widths ───────────────────────────────────────────────────────
    colSubject: { flex: 2.5 },
    colTh:      { width: 54, textAlign: 'center' as const },
    colPr:      { width: 54, textAlign: 'center' as const },
    colTotal:   { width: 34, textAlign: 'center' as const },
    colObt:     { width: 34, textAlign: 'center' as const },
    colPct:     { width: 38, textAlign: 'center' as const },
    colGrade:   { width: 30, textAlign: 'center' as const },
    colStatus:  { width: 32, textAlign: 'center' as const },

    // ── Pass/Fail — B&W friendly (bold text, no colour fill) ────────────────
    passText: { fontSize: 7.5, fontWeight: 700, color: '#000', textAlign: 'center' as const },
    failText: { fontSize: 7.5, fontWeight: 700, color: '#000', textAlign: 'center' as const,
                textDecoration: 'underline' as const },   // underline marks FAIL without needing colour

    // ── Fixed page footer ───────────────────────────────────────────────────
    footer: {
        position: 'absolute',
        bottom: 10,
        left: 24,
        right: 24,
        borderTopWidth: 0.5,
        borderTopColor: '#bbb',
        paddingTop: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerTxt: { fontSize: 7, color: '#888', fontStyle: 'italic' },
    footerRight: { fontSize: 7, color: '#888', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 },
});

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return String(n);
}

function fmtPct(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${n.toFixed(1)}%`;
}

// ── Shared school header (reused on every Page) ───────────────────────────
function SchoolHeader({ school, showDivider = true }: { school: SchoolInfoForResultPDF; showDivider?: boolean }) {
    return (
        <View style={s.hdr}>
            {/* Logo centred without breaking text alignment */}
            {school.logoBase64 && (
                <View style={s.logoWrap}>
                    <Image src={school.logoBase64} style={s.logo} />
                </View>
            )}

            {/* All school text is full-width → textAlign:'center' works correctly */}
            <Text style={s.schoolName}>{school.name}</Text>
            {school.tagline && <Text style={s.tagline}>{school.tagline}</Text>}
            {school.address && <Text style={s.addr}>{school.address}</Text>}
            {(school.phone || school.email || school.website) && (
                <Text style={s.ctTxt}>
                    {[school.phone, school.email, school.website
                        ? school.website.replace(/^https?:\/\//, '')
                        : null,
                    ].filter(Boolean).join('  •  ')}
                </Text>
            )}
            <Text style={s.cardLabel}>Examination Result Card</Text>
            {showDivider && <View style={s.divider} />}
        </View>
    );
}

// ── Compact student strip (shown on pages 2+) ─────────────────────────────
function StudentStrip({ data }: { data: ResultDataForPDF }) {
    const parts = [
        data.studentName,
        [data.className, data.sectionName].filter(Boolean).join(' – '),
        data.rollNo   ? `Roll: ${data.rollNo}`        : null,
        data.sessionLabel ? `Session: ${data.sessionLabel}` : null,
    ].filter(Boolean).join('   |   ');
    return (
        <View style={{ paddingTop: 6, paddingBottom: 6, paddingLeft: 24, paddingRight: 24,
                        borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
            <Text style={{ fontSize: 8, color: '#444', textAlign: 'center' }}>{parts}</Text>
        </View>
    );
}

// ── Per-category marks table ──────────────────────────────────────────────
function CategoryTable({ cat, hasSplitSubject }: { cat: CategoryResultForPDF; hasSplitSubject: boolean }) {
    return (
        <View>
            {/* Category title */}
            <Text style={s.catTitle}>{cat.categoryName}</Text>

            {/* Table */}
            <View style={s.tbl}>
                {/* Header row */}
                <View style={s.tblHdr}>
                    <Text style={[s.tblHdrTxt, s.colSubject]}>Subject</Text>
                    {hasSplitSubject && (
                        <>
                            <Text style={[s.tblHdrTxt, s.colTh]}>Theory{'\n'}(Tot / Obt)</Text>
                            <Text style={[s.tblHdrTxt, s.colPr]}>Practical{'\n'}(Tot / Obt)</Text>
                        </>
                    )}
                    <Text style={[s.tblHdrTxt, s.colTotal]}>Total</Text>
                    <Text style={[s.tblHdrTxt, s.colObt]}>Obtained</Text>
                    <Text style={[s.tblHdrTxt, s.colPct]}>%</Text>
                    <Text style={[s.tblHdrTxt, s.colGrade]}>Grade</Text>
                    <Text style={[s.tblHdrTxt, s.colStatus]}>Status</Text>
                </View>

                {/* Subject rows */}
                {cat.subjects.map((subj, idx) => {
                    const isSplit = subj.hasTheory && subj.hasPractical;
                    const isLast  = idx === cat.subjects.length - 1;
                    return (
                        <View
                            key={subj.subjectName}
                            style={[s.tblRow, isLast ? { borderBottomWidth: 0 } : {}]}
                        >
                            <Text style={[s.tblCell, s.colSubject]}>{subj.subjectName}</Text>
                            {hasSplitSubject && (
                                <>
                                    <Text style={[s.tblCell, s.colTh]}>
                                        {isSplit ? `${fmt(subj.theoryTotal)} / ${fmt(subj.theoryObtained)}` : '—'}
                                    </Text>
                                    <Text style={[s.tblCell, s.colPr]}>
                                        {isSplit ? `${fmt(subj.practicalTotal)} / ${fmt(subj.practicalObtained)}` : '—'}
                                    </Text>
                                </>
                            )}
                            <Text style={[s.tblCell, s.colTotal]}>{fmt(subj.totalMarks)}</Text>
                            <Text style={[s.tblCell, s.colObt]}>{fmt(subj.obtainedMarks)}</Text>
                            <Text style={[s.tblCell, s.colPct]}>{fmtPct(subj.percentage)}</Text>
                            <Text style={[s.tblCellBold, s.colGrade]}>{subj.grade ?? '—'}</Text>
                            <Text style={subj.isPass === false ? s.failText : s.passText}>
                                {subj.isPass === true ? 'PASS' : subj.isPass === false ? 'FAIL' : '—'}
                            </Text>
                        </View>
                    );
                })}

                {/* Overall footer row */}
                <View style={s.tblFooter}>
                    <Text style={[s.tblCellBold, s.colSubject]}>Overall</Text>
                    {hasSplitSubject && (
                        <>
                            <Text style={[s.tblCell, s.colTh]}>—</Text>
                            <Text style={[s.tblCell, s.colPr]}>—</Text>
                        </>
                    )}
                    <Text style={[s.tblCellBold, s.colTotal]}>{fmt(cat.sumTotal)}</Text>
                    <Text style={[s.tblCellBold, s.colObt]}>{fmt(cat.sumObtained)}</Text>
                    <Text style={[s.tblCellBold, s.colPct]}>{fmtPct(cat.overallPercentage)}</Text>
                    <Text style={[s.tblCellBold, s.colGrade]}>{cat.overallGrade ?? '—'}</Text>
                    <Text style={cat.overallPass === false ? s.failText : s.passText}>
                        {cat.overallPass === true ? 'PASS' : cat.overallPass === false ? 'FAIL' : '—'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ── Result Document ───────────────────────────────────────────────────────
// One page per exam category so a category never splits across pages.
interface Props { data: ResultDataForPDF; school: SchoolInfoForResultPDF; }

function ResultDocument({ data, school }: Props) {
    const hasSplitSubject = data.categories.some(cat =>
        cat.subjects.some(s => s.hasTheory && s.hasPractical)
    );

    // Page 1: full header + student box + first category
    // Pages 2+: compact header + student strip + one category each
    const [firstCat, ...restCats] = data.categories;

    return (
        <Document>
            {/* ── Page 1 ── */}
            <Page size="A4" style={s.page}>
                <SchoolHeader school={school} />

                <View style={s.body}>
                    {/* Student details box */}
                    <View style={s.studentBox}>
                        <Text style={s.studentBoxTitle}>Student Details</Text>
                        <Text style={s.studentName}>{data.studentName}</Text>
                        <View style={s.studentMetaRow}>
                            <View style={s.metaPair}>
                                <Text style={s.metaLbl}>Class</Text>
                                <Text style={s.metaVal}>
                                    {[data.className, data.sectionName].filter(Boolean).join(' – ')}
                                </Text>
                            </View>
                            {data.rollNo && (
                                <View style={s.metaPair}>
                                    <Text style={s.metaLbl}>Roll No.</Text>
                                    <Text style={s.metaVal}>{data.rollNo}</Text>
                                </View>
                            )}
                            {data.admissionNo && (
                                <View style={s.metaPair}>
                                    <Text style={s.metaLbl}>Admission No.</Text>
                                    <Text style={s.metaVal}>{data.admissionNo}</Text>
                                </View>
                            )}
                            <View style={s.metaPair}>
                                <Text style={s.metaLbl}>Session</Text>
                                <Text style={s.metaVal}>{data.sessionLabel}</Text>
                            </View>
                        </View>
                    </View>

                    {/* First category */}
                    {firstCat && (
                        <CategoryTable
                            cat={firstCat}
                            hasSplitSubject={hasSplitSubject}
                        />
                    )}
                </View>

                {/* Fixed footer on every page of this page's flow */}
                <View style={s.footer} fixed>
                    <Text style={s.footerTxt}>Generated on: {data.generatedAt}</Text>
                    <Text style={s.footerRight}>Result Card</Text>
                </View>
            </Page>

            {/* ── Additional pages — one per remaining category ── */}
            {restCats.map((cat) => (
                <Page key={cat.categoryName} size="A4" style={s.page}>
                    {/* Compact school header */}
                    <SchoolHeader school={school} showDivider={false} />
                    {/* Student info strip */}
                    <StudentStrip data={data} />

                    <View style={[s.body, { paddingTop: 12 }]}>
                        <CategoryTable cat={cat} hasSplitSubject={hasSplitSubject} />
                    </View>

                    <View style={s.footer} fixed>
                        <Text style={s.footerTxt}>Generated on: {data.generatedAt}</Text>
                        <Text style={s.footerRight}>Result Card</Text>
                    </View>
                </Page>
            ))}
        </Document>
    );
}

// ── Public render function ────────────────────────────────────────────────
export async function renderResultPDF(
    data: ResultDataForPDF,
    school: SchoolInfoForResultPDF,
): Promise<Buffer> {
    const buf = await renderToBuffer(<ResultDocument data={data} school={school} />);
    return Buffer.from(buf);
}
