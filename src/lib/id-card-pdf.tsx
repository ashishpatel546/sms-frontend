import React from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import {
  formatIdCardDate,
  idCardInitials,
  idCardRoleLine,
  type IdCardBranding,
  type IdCardRow,
} from './id-card-api';
import { getSchoolLogoDataUrl } from './useSchoolInfo';

/* ═══════════════════════════════════════════════════════════════════════════
   THE ID CARD

   This is the one thing in the app that leaves the screen. A child wears it on
   a lanyard for a year; a teacher shows it at a bank. So it is drawn as a
   printed artifact, not as a screen rendered to paper.

   THE DESIGN, AND WHY

   · CR80, exactly. 85.6 × 54 mm = 242.65 × 153.07 pt — the same blank every
     card printer, lanyard holder and wallet in the country is cut for. It is
     never scaled to the page.

   · SQUARE CORNERS. The rounded corner on a finished card comes from the die,
     not from the artwork. Drawing one in would put a white notch inside the
     cut. The hairline around the card IS the cut line.

   · THE SPINE. A 6pt walnut band down the left edge with a brass hairline
     beside it. This is the app's own signature — the ruled margin of a school
     register — carried onto the card, and it is what makes a card from this
     system recognisable across a hall. It also gives the front and back a
     shared anchor, so a stack of cards reads as one object.

   · THE PIGMENTS KEEP THEIR JOBS. Walnut is the frame, brass is the school's
     mark, ink is information. Vermilion appears exactly once, on the blood
     group, because that is the one field somebody reads in a hurry and the
     rule "red means urgent" is the whole point of putting it on a card.

   · TYPE IS THE APP'S, IN THE FACES A PDF CAN GUARANTEE. Helvetica-Bold for
     names, Helvetica for prose, Courier-Bold for the micro-caps labels — the
     same three roles as the screen's Sora / Figtree / IBM Plex Mono. Embedding
     the real faces would add ~300 KB to a bundle for a document that is
     printed once, and would fail offline, where a school office often is.

   Nothing here fetches. Photos, the logo and the QR are resolved into data
   URLs first (see `prepareIdCards`), because a remote image that 404s inside
   react-pdf takes the whole document down with it — and a school with no
   photos uploaded yet must still get printable cards.
   ═══════════════════════════════════════════════════════════════════════════ */

/** CR80 in PDF points. */
export const CARD_W = 242.65;
export const CARD_H = 153.07;

const A4_W = 595.28;
const A4_H = 841.89;

/** 2 across, 5 down — ten cards, butted, on one A4 sheet. */
const COLS = 2;
const ROWS = 5;
export const CARDS_PER_SHEET = COLS * ROWS;

const BLOCK_W = CARD_W * COLS;
const BLOCK_H = CARD_H * ROWS;
const MARGIN_X = (A4_W - BLOCK_W) / 2;
const MARGIN_Y = (A4_H - BLOCK_H) / 2;

/* Palette lifted straight from globals.css so the card and the app are the
   same school. Print-safe steps only — nothing relies on a screen's gamut. */
const WALNUT = '#362b1f';
const WALNUT_DEEP = '#241c12';
const BRASS = '#7d4907';
const MARIGOLD = '#f5a524';
const BRASS_PALE = '#e2b871';
const PAPER = '#ffffff';
const PAPER_TINT = '#faf8f3';
const INSET = '#eae5dc';
const INK = '#211c16';
const INK_SOFT = '#57504a';
const INK_MUTED = '#756d65';
const INK_FAINT = '#948c83';
const LINE = '#e2ddd3';
const LINE_STRONG = '#cdc5b7';
const VERMILION = '#c41d1d';
const GUIDE = '#b8b2a6';

/** Placeholder tiles, matching `AVATAR_TONES` in ui/InitialsAvatar. */
const TONES = ['#a9670c', '#1e4fd8', '#0b7a55', '#7c52e0', '#b4740c'];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return TONES[hash % TONES.length];
}

/** A long name must still fit on one line rather than pushing the card apart. */
function nameSize(name: string): number {
  const n = name.length;
  if (n <= 17) return 12.5;
  if (n <= 22) return 11;
  if (n <= 28) return 9.6;
  return 8.4;
}

const styles = StyleSheet.create({
  /* ── The blank ───────────────────────────────────────────────────────── */
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: PAPER,
    flexDirection: 'row',
    // The hairline is the cut line, not decoration.
    borderWidth: 0.5,
    borderColor: LINE_STRONG,
  },
  spine: { width: 6, backgroundColor: WALNUT },
  spineBrass: { width: 1.2, backgroundColor: BRASS },
  body: { flex: 1, flexDirection: 'column' },

  /* ── Front: masthead ─────────────────────────────────────────────────── */
  masthead: {
    height: 36,
    backgroundColor: WALNUT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  logoTile: {
    width: 24,
    height: 24,
    backgroundColor: PAPER,
    borderRadius: 3,
    marginRight: 7,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 20, height: 20, objectFit: 'contain' },
  logoFallback: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: BRASS,
  },
  schoolName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    lineHeight: 1.15,
    color: PAPER,
  },
  schoolKicker: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.6,
    letterSpacing: 0.7,
    color: BRASS_PALE,
    marginTop: 1.5,
  },
  sessionBlock: { alignItems: 'flex-end', marginLeft: 6 },
  sessionLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.2,
    letterSpacing: 0.6,
    color: BRASS_PALE,
  },
  sessionValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: MARIGOLD,
    marginTop: 1,
  },
  brassRule: { height: 2, backgroundColor: BRASS },

  /* ── Front: the person ───────────────────────────────────────────────── */
  front: { flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 7 },
  photoFrame: {
    width: 55,
    height: 72.3,
    backgroundColor: INSET,
    borderWidth: 0.6,
    borderColor: LINE_STRONG,
    padding: 1.5,
  },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: PAPER,
  },
  details: { flex: 1, paddingLeft: 8 },
  holderName: { fontFamily: 'Helvetica-Bold', color: INK },
  roleLine: {
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: INK_MUTED,
    marginTop: 2,
  },
  hair: { height: 0.6, backgroundColor: LINE, marginTop: 6, marginBottom: 6 },
  fieldRow: { flexDirection: 'row', marginBottom: 5 },
  field: { flex: 1, paddingRight: 4 },
  fieldLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.4,
    letterSpacing: 0.55,
    color: INK_FAINT,
  },
  fieldValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.2,
    color: INK,
    marginTop: 1.5,
  },

  /* ── Front: the strip that gets read in a hurry ──────────────────────── */
  emergency: {
    height: 21,
    backgroundColor: PAPER_TINT,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  bloodPill: {
    backgroundColor: VERMILION,
    paddingHorizontal: 4.5,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 6,
  },
  bloodPillText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: PAPER,
  },
  stripLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.2,
    letterSpacing: 0.55,
    color: INK_FAINT,
  },
  stripValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.4,
    color: INK,
    marginTop: 1,
  },

  /* ── Back ────────────────────────────────────────────────────────────── */
  backBar: {
    height: 17,
    backgroundColor: WALNUT_DEEP,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBarName: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    color: PAPER,
  },
  backBarTag: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.4,
    letterSpacing: 0.8,
    color: MARIGOLD,
  },
  backBody: { flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 7 },
  qrFrame: {
    width: 74,
    height: 74,
    backgroundColor: PAPER,
    borderWidth: 0.6,
    borderColor: LINE_STRONG,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImg: { width: '100%', height: '100%' },
  qrCaption: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.2,
    letterSpacing: 0.5,
    color: INK_FAINT,
    marginTop: 3,
    textAlign: 'center',
    width: 74,
  },
  backText: { flex: 1, paddingLeft: 9 },
  eyebrow: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.4,
    letterSpacing: 0.7,
    color: BRASS,
  },
  returnCopy: {
    fontFamily: 'Helvetica',
    fontSize: 5.9,
    lineHeight: 1.35,
    color: INK_SOFT,
    marginTop: 3,
  },
  returnSchool: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.6,
    color: INK,
    marginTop: 4,
  },
  returnDetail: {
    fontFamily: 'Helvetica',
    fontSize: 5.9,
    lineHeight: 1.35,
    color: INK_MUTED,
    marginTop: 2,
  },
  backFoot: {
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 5,
  },
  validity: {
    flex: 1,
    fontFamily: 'Helvetica',
    fontSize: 5,
    lineHeight: 1.3,
    color: INK_MUTED,
    paddingRight: 8,
  },
  signBlock: { width: 74, alignItems: 'center' },
  signRule: { width: 74, height: 0.6, backgroundColor: LINE_STRONG },
  signLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 3.9,
    letterSpacing: 0.5,
    color: INK_FAINT,
    marginTop: 2.5,
  },

  /* ── Sheets ──────────────────────────────────────────────────────────── */
  sheet: { backgroundColor: PAPER },
  grid: {
    position: 'absolute',
    top: MARGIN_Y,
    left: MARGIN_X,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: BLOCK_W,
  },
  slot: { width: CARD_W, height: CARD_H },
  sheetCaption: {
    position: 'absolute',
    left: MARGIN_X,
    right: MARGIN_X,
    bottom: 14,
    fontFamily: 'Courier-Bold',
    fontSize: 5.5,
    letterSpacing: 0.5,
    color: INK_FAINT,
  },
  guide: { position: 'absolute', backgroundColor: GUIDE },

  /* A card never reflows to fit its text — it clips, exactly as the preview
     does, so a long name can never push the layout apart. */
  clip1: { maxLines: 1, textOverflow: 'ellipsis' },
  clip2: { maxLines: 2, textOverflow: 'ellipsis' },
  clip3: { maxLines: 3, textOverflow: 'ellipsis' },
});

/* ── Small pieces ────────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, styles.clip1]}>
        {value}
      </Text>
    </View>
  );
}

function Spine() {
  return (
    <>
      <View style={styles.spine} />
      <View style={styles.spineBrass} />
    </>
  );
}

export interface PreparedIdCard {
  row: IdCardRow;
  /** QR as a PNG data URL. Always present — it is generated locally. */
  qrDataUrl: string;
  /** Holder photo as a data URL, or null when there is none / it failed. */
  photoDataUrl: string | null;
}

interface FaceProps {
  card: PreparedIdCard;
  school: IdCardBranding;
  logoDataUrl: string | null;
}

/* ── Front ───────────────────────────────────────────────────────────────── */

export function IdCardFront({ card, school, logoDataUrl }: FaceProps) {
  const { row } = card;
  const isStudent = row.type === 'STUDENT';
  const guardian = row.fathersName ?? row.guardianName;

  return (
    <View style={styles.card}>
      <Spine />
      <View style={styles.body}>
        <View style={styles.masthead}>
          <View style={styles.logoTile}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoFallback}>
                {idCardInitials(school.name)}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.schoolName, styles.clip2]}>
              {school.name}
            </Text>
            <Text style={styles.schoolKicker}>
              {isStudent ? 'STUDENT IDENTITY CARD' : 'STAFF IDENTITY CARD'}
            </Text>
          </View>
          {school.session ? (
            <View style={styles.sessionBlock}>
              <Text style={styles.sessionLabel}>SESSION</Text>
              <Text style={styles.sessionValue}>{school.session}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.brassRule} />

        <View style={styles.front}>
          <View style={styles.photoFrame}>
            {card.photoDataUrl ? (
              <Image src={card.photoDataUrl} style={styles.photo} />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  { backgroundColor: toneFor(row.name) },
                ]}
              >
                <Text style={styles.placeholderText}>
                  {idCardInitials(row.name)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.details}>
            <Text
              style={[styles.holderName, styles.clip2, { fontSize: nameSize(row.name) }]}
            >
              {row.name}
            </Text>
            <Text style={[styles.roleLine, styles.clip1]}>
              {idCardRoleLine(row)}
            </Text>
            <View style={styles.hair} />

            {isStudent ? (
              <>
                <View style={styles.fieldRow}>
                  <Field label="CLASS" value={classLabel(row)} />
                  <Field
                    label="ROLL NO"
                    value={row.rollNo != null ? String(row.rollNo) : '—'}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Field label="DATE OF BIRTH" value={formatIdCardDate(row.dob)} />
                  <Field label="GUARDIAN" value={guardian ?? '—'} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldRow}>
                  <Field
                    label="EMPLOYEE CODE"
                    value={row.employeeCode != null ? String(row.employeeCode) : '—'}
                  />
                  <Field label="DEPARTMENT" value={row.department ?? '—'} />
                </View>
                <View style={styles.fieldRow}>
                  <Field label="DESIGNATION" value={row.designation ?? '—'} />
                  <Field label="DATE OF BIRTH" value={formatIdCardDate(row.dob)} />
                </View>
              </>
            )}
          </View>
        </View>

        {/* The one strip somebody reads in an emergency. */}
        <View style={styles.emergency}>
          {row.bloodGroup ? (
            <View style={styles.bloodPill}>
              <Text style={styles.bloodPillText}>{row.bloodGroup}</Text>
            </View>
          ) : null}
          <View style={{ width: 46 }}>
            <Text style={styles.stripLabel}>BLOOD GROUP</Text>
            {!row.bloodGroup ? (
              <Text style={styles.stripValue}>Not recorded</Text>
            ) : null}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.stripLabel}>
              {isStudent ? 'PARENT CONTACT' : 'CONTACT'}
            </Text>
            <Text style={[styles.stripValue, styles.clip1]}>
              {row.mobile ?? school.phone ?? '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function classLabel(row: IdCardRow): string {
  if (!row.className) return '—';
  return row.section ? `${row.className} — ${row.section}` : row.className;
}

/* ── Back ────────────────────────────────────────────────────────────────── */

export function IdCardBack({ card, school }: FaceProps) {
  const { row } = card;

  return (
    <View style={styles.card}>
      <Spine />
      <View style={styles.body}>
        <View style={styles.backBar}>
          <Text style={[styles.backBarName, styles.clip1]}>
            {school.name}
          </Text>
          <Text style={styles.backBarTag}>
            {row.type === 'STUDENT' ? 'STUDENT' : 'STAFF'}
          </Text>
        </View>

        <View style={styles.backBody}>
          <View>
            <View style={styles.qrFrame}>
              <Image src={card.qrDataUrl} style={styles.qrImg} />
            </View>
            <Text style={styles.qrCaption}>SCAN AT THE GATE</Text>
          </View>

          <View style={styles.backText}>
            <Text style={styles.eyebrow}>IF FOUND</Text>
            <Text style={styles.returnCopy}>
              Please return this card to the school office, or hand it in at the
              address below.
            </Text>
            <Text style={[styles.returnSchool, styles.clip2]}>
              {school.name}
            </Text>
            {school.address ? (
              <Text style={[styles.returnDetail, styles.clip3]}>
                {school.address}
              </Text>
            ) : null}
            {school.phone ? (
              <Text style={styles.returnDetail}>Tel {school.phone}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.backFoot}>
          <Text style={styles.validity}>
            {school.session
              ? `Valid for the ${school.session} academic session. `
              : ''}
            This card remains the property of the school. It is not
            transferable and must be surrendered on leaving.
          </Text>
          <View style={styles.signBlock}>
            <View style={styles.signRule} />
            <Text style={styles.signLabel}>AUTHORISED SIGNATORY</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Cut guides ──────────────────────────────────────────────────────────────
   Marks sit OUTSIDE the block so no line is ever printed on a card. The cards
   themselves are butted edge to edge, which is what a guillotine wants: one
   cut serves the two cards either side of it. */

function CutGuides() {
  const marks: React.ReactElement[] = [];
  const reach = 11;
  const gap = 3.5;

  for (let c = 0; c <= COLS; c += 1) {
    const x = MARGIN_X + c * CARD_W;
    marks.push(
      <View
        key={`v-top-${c}`}
        style={[styles.guide, { left: x, top: MARGIN_Y - gap - reach, width: 0.4, height: reach }]}
      />,
      <View
        key={`v-bottom-${c}`}
        style={[styles.guide, { left: x, top: MARGIN_Y + BLOCK_H + gap, width: 0.4, height: reach }]}
      />,
    );
  }

  for (let r = 0; r <= ROWS; r += 1) {
    const y = MARGIN_Y + r * CARD_H;
    marks.push(
      <View
        key={`h-left-${r}`}
        style={[styles.guide, { top: y, left: MARGIN_X - gap - reach, width: reach, height: 0.4 }]}
      />,
      <View
        key={`h-right-${r}`}
        style={[styles.guide, { top: y, left: MARGIN_X + BLOCK_W + gap, width: reach, height: 0.4 }]}
      />,
    );
  }

  return <>{marks}</>;
}

/* ── Sheets ──────────────────────────────────────────────────────────────────
   DUPLEX ARRANGEMENT

   Fronts and backs alternate as whole pages: F, B, F, B … so a duplex printer
   set to "flip on long edge" (the portrait default) puts the right back behind
   the right front.

   Flipping on the long edge mirrors the sheet left-to-right, so on a backs page
   each row's two columns are SWAPPED. Card `i` sits at (row, col) on the front
   and (row, 1 - col) on the back. Partly-filled sheets fall out of the same
   rule — the empty slot simply lands on the mirrored side. */

function backSlots(cards: PreparedIdCard[]): (PreparedIdCard | null)[] {
  const slots: (PreparedIdCard | null)[] = Array.from(
    { length: CARDS_PER_SHEET },
    () => null,
  );
  cards.forEach((card, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    slots[row * COLS + (COLS - 1 - col)] = card;
  });
  return slots;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function Sheet({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <Page size="A4" style={styles.sheet}>
      <CutGuides />
      <View style={styles.grid}>{children}</View>
      <Text style={styles.sheetCaption}>{caption}</Text>
    </Page>
  );
}

export function IdCardBatchDocument({
  cards,
  school,
  logoDataUrl,
}: {
  cards: PreparedIdCard[];
  school: IdCardBranding;
  logoDataUrl: string | null;
}) {
  const sheets = chunk(cards, CARDS_PER_SHEET);
  const guidance =
    'Print at 100% (no "fit to page") on both sides, flipping on the LONG edge.';

  return (
    <Document
      title={`ID cards — ${school.name}`}
      author={school.name}
      subject="Printable identity cards"
    >
      {sheets.flatMap((sheet, index) => [
        <Sheet
          key={`front-${index}`}
          caption={`Sheet ${index + 1} of ${sheets.length} · FRONTS · ${guidance}`}
        >
          {sheet.map((card, i) => (
            <View key={`f-${i}`} style={styles.slot}>
              <IdCardFront card={card} school={school} logoDataUrl={logoDataUrl} />
            </View>
          ))}
        </Sheet>,
        <Sheet
          key={`back-${index}`}
          caption={`Sheet ${index + 1} of ${sheets.length} · BACKS · columns mirrored for long-edge duplex`}
        >
          {backSlots(sheet).map((card, i) => (
            <View key={`b-${i}`} style={styles.slot}>
              {card ? (
                <IdCardBack card={card} school={school} logoDataUrl={logoDataUrl} />
              ) : null}
            </View>
          ))}
        </Sheet>,
      ])}
    </Document>
  );
}

/* ── One card, for a parent or a reprint ─────────────────────────────────────
   Stacked rather than side by side: a parent prints this at home and cuts it
   out, and two faces one above the other survive an off-centre A4 feed. */

const single = StyleSheet.create({
  page: { backgroundColor: PAPER, paddingTop: 56, alignItems: 'center' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK },
  subtitle: {
    fontFamily: 'Courier-Bold',
    fontSize: 6,
    letterSpacing: 0.8,
    color: INK_FAINT,
    marginTop: 5,
    marginBottom: 26,
  },
  faceLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 5.5,
    letterSpacing: 0.8,
    color: INK_FAINT,
    width: CARD_W,
    marginBottom: 4,
  },
  gapAfterFront: { height: 26 },
  note: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: INK_MUTED,
    width: CARD_W,
    marginTop: 26,
    lineHeight: 1.45,
  },
});

export function IdCardSingleDocument({
  card,
  school,
  logoDataUrl,
}: {
  card: PreparedIdCard;
  school: IdCardBranding;
  logoDataUrl: string | null;
}) {
  return (
    <Document title={`ID card — ${card.row.name}`} author={school.name}>
      <Page size="A4" style={single.page}>
        <Text style={single.title}>{card.row.name}</Text>
        <Text style={single.subtitle}>
          {school.name.toUpperCase()}
          {school.session ? ` · ${school.session}` : ''}
        </Text>

        <Text style={single.faceLabel}>FRONT</Text>
        <IdCardFront card={card} school={school} logoDataUrl={logoDataUrl} />
        <View style={single.gapAfterFront} />
        <Text style={single.faceLabel}>BACK</Text>
        <IdCardBack card={card} school={school} logoDataUrl={logoDataUrl} />

        <Text style={single.note}>
          Print at 100% — do not select &quot;fit to page&quot;, or the card
          will not match a standard card holder. Cut along the hairline, then
          glue the two faces back to back.
        </Text>
      </Page>
    </Document>
  );
}

/* ── Asset preparation ───────────────────────────────────────────────────────
   react-pdf resolves an <Image src> by fetching it, and a single failed fetch
   rejects the whole document. Photos come from a presigned S3 URL that may be
   expired, blocked by CORS or simply missing, so every one is resolved here
   FIRST and a failure degrades to the initials tile — one missing portrait can
   never cost a school its print run. */

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Resolve N promises a few at a time — 100 parallel S3 GETs help nobody. */
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

/**
 * Renders each row's QR and pulls its photo down as a data URL.
 *
 * `onProgress` reports resolved rows so a 100-card batch can show real
 * progress instead of a spinner that looks stuck.
 */
export async function prepareIdCards(
  rows: IdCardRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<PreparedIdCard[]> {
  const { default: QRCode } = await import('qrcode');

  let done = 0;
  return mapPooled(rows, 6, async (row) => {
    const [qrDataUrl, photoDataUrl] = await Promise.all([
      QRCode.toDataURL(row.qrToken, {
        errorCorrectionLevel: 'M',
        margin: 0,
        // Oversampled: the QR prints at ~26 mm, and a crisp module edge is the
        // difference between a scan that works on the first try and one that
        // does not.
        width: 480,
        color: { dark: '#1c150dff', light: '#ffffffff' },
      }),
      row.photoUrl ? toDataUrl(row.photoUrl) : Promise.resolve(null),
    ]);
    done += 1;
    onProgress?.(done, rows.length);
    return { row, qrDataUrl, photoDataUrl };
  });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'id-cards'
  );
}

export interface IdCardPdfOptions {
  fileName?: string;
  onProgress?: (done: number, total: number) => void;
}

/** Batch print sheets. Returns the number of sheets produced. */
export async function downloadIdCardBatchPdf(
  rows: IdCardRow[],
  school: IdCardBranding,
  options: IdCardPdfOptions = {},
): Promise<number> {
  const [cards, logoDataUrl] = await Promise.all([
    prepareIdCards(rows, options.onProgress),
    getSchoolLogoDataUrl(),
  ]);

  const blob = await pdf(
    <IdCardBatchDocument cards={cards} school={school} logoDataUrl={logoDataUrl} />,
  ).toBlob();

  saveBlob(
    blob,
    options.fileName ?? `id-cards-${slugify(school.name)}-${rows.length}.pdf`,
  );
  return Math.ceil(rows.length / CARDS_PER_SHEET);
}

/** One card, front and back, on a single A4 page. */
export async function downloadSingleIdCardPdf(
  row: IdCardRow,
  school: IdCardBranding,
  options: IdCardPdfOptions = {},
): Promise<void> {
  const [cards, logoDataUrl] = await Promise.all([
    prepareIdCards([row], options.onProgress),
    getSchoolLogoDataUrl(),
  ]);

  const blob = await pdf(
    <IdCardSingleDocument
      card={cards[0]}
      school={school}
      logoDataUrl={logoDataUrl}
    />,
  ).toBlob();

  saveBlob(blob, options.fileName ?? `id-card-${slugify(row.name)}.pdf`);
}
