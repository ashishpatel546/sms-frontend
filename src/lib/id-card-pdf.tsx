import React from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
  type DocumentProps,
} from '@react-pdf/renderer';
import {
  idCardAddress,
  idCardBloodGroup,
  idCardContact,
  idCardFields,
  idCardInitials,
  idCardRoleLine,
  loadIdCardPhoto,
  toPdfSafeDataUrl,
  getSchoolSignature,
  toPdfSafeLogo,
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
    height: 34,
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
  front: { flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 5 },
  photoFrame: {
    // 21 × 27 mm, close to a passport photo's 35 × 45 proportion. A face is
    // what a card is FOR — the old 55 × 72 frame made the portrait an
    // illustration beside the text rather than the subject of the card.
    width: 60,
    height: 76,
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
    fontSize: 22,
    color: PAPER,
  },
  details: { flex: 1, paddingLeft: 8 },
  holderName: { fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1.1 },
  roleLine: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: BRASS,
    marginTop: 2.5,
  },
  hair: { height: 0.6, backgroundColor: LINE, marginTop: 5.5, marginBottom: 5 },
  /* One field per LINE, label left and value right, rather than a 2 × 2 grid.
     Two columns at this size meant 4.4 pt labels and values that collided with
     a long name; a single column gives each value the whole card width and
     cannot run out of vertical room as fields are added. */
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3.6,
  },
  fieldLabel: {
    width: 40,
    fontFamily: 'Courier-Bold',
    fontSize: 4.6,
    letterSpacing: 0.5,
    color: INK_FAINT,
  },
  fieldValue: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.2,
    color: INK,
  },

  /* ── Front: the band that gets read in a hurry ─────────────────────────
     Blood group, where the holder lives, and the number to ring — the three
     things an adult needs when a child is hurt, lost, or being collected by
     a stranger. One band, same place on every card in the school, so nobody
     hunts. Everything about WHO the holder is stays in the grid above; this
     band is only about reaching them. */
  emergency: {
    height: 24,
    backgroundColor: PAPER_TINT,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  /* The address is the one value on the card that genuinely cannot be capped:
     `address` is line 1 + line 2 + city + state + postcode joined together, so
     a real one runs past any single line this band can offer. It gets its own
     smaller size and TWO lines, which fits every address in the seed data and
     degrades to an ellipsis rather than a lie for the few that don't. */
  addressValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.2,
    lineHeight: 1.2,
    color: INK,
    marginTop: 1,
  },
  /* The pill is ALWAYS drawn, even with no blood group on file — it goes
     muted and reads "—" instead of vanishing. A stack of cards where the
     accent appears on some and not others looks misprinted, and the fixed
     slot is also what keeps the address starting at the same x on every
     card. Width is fixed for the same reason: "AB+" must not shove the
     address further right than "O-". */
  bloodPill: {
    width: 26,
    paddingVertical: 2.2,
    borderRadius: 2,
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodPillFilled: { backgroundColor: VERMILION },
  bloodPillEmpty: {
    backgroundColor: PAPER,
    borderWidth: 0.6,
    borderColor: LINE_STRONG,
  },
  bloodPillText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.6,
    color: PAPER,
  },
  bloodPillTextEmpty: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.6,
    color: INK_FAINT,
  },
  stripCell: { marginRight: 9 },
  stripLabel: {
    fontFamily: 'Courier-Bold',
    fontSize: 4.2,
    letterSpacing: 0.55,
    color: INK_FAINT,
  },
  stripValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
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
  backBody: { flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6 },
  qrFrame: {
    // 27 mm square. A phone camera at arm's length in a queue wants every
    // module it can get; this is the largest square the back can spare.
    width: 78,
    height: 78,
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
    marginTop: 2.5,
    textAlign: 'center',
    width: 78,
  },
  backText: { flex: 1, paddingLeft: 9 },
  /* The holder, named on the back too. A card face-down on a desk, or a stack
     waiting to be handed out, is otherwise anonymous. */
  backHolder: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: INK,
    lineHeight: 1.1,
  },
  backHolderMeta: {
    fontFamily: 'Helvetica',
    fontSize: 5.8,
    color: INK_MUTED,
    marginTop: 1.5,
    marginBottom: 5,
  },
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
  /* The signature sits ON the rule, not above a gap — that is how a signed
     document looks. Fixed height so a tall scan cannot push the footer into
     the QR, `objectFit: contain` so it is never stretched. */
  signImage: { width: 64, height: 15, objectFit: 'contain', marginBottom: 1 },
  signSpacer: { height: 16 },
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
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, styles.clip1]}>{value}</Text>
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

/**
 * The two school-level images a card draws, resolved to data URLs before any
 * rendering starts. They travel together because they share a lifecycle: both
 * are fetched once per document, both are dropped together when a render has
 * to fall back, and neither may be a remote URL (react-pdf would fetch it, and
 * one failed fetch rejects the whole document).
 */
export interface IdCardAssets {
  logoDataUrl: string | null;
  /** Null when the school has not uploaded one — the card prints a blank rule. */
  signatureDataUrl: string | null;
}

interface FaceProps {
  card: PreparedIdCard;
  school: IdCardBranding;
  assets: IdCardAssets;
}

/* ── Front ───────────────────────────────────────────────────────────────── */

export function IdCardFront({ card, school, assets }: FaceProps) {
  const { row } = card;
  const isStudent = row.type === 'STUDENT';
  // One per line. Class, section, roll and designation are NOT here — the
  // line under the name already says them.
  const fields = idCardFields(row);
  const bloodGroup = idCardBloodGroup(row);

  return (
    <View style={styles.card}>
      <Spine />
      <View style={styles.body}>
        <View style={styles.masthead}>
          <View style={styles.logoTile}>
            {assets.logoDataUrl ? (
              <Image src={assets.logoDataUrl} style={styles.logoImg} />
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

            {fields.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </View>
        </View>

        {/* The band somebody reads under pressure — always in the same place
            on every card in the school, so nobody has to hunt for it. */}
        <View style={styles.emergency}>
          <View
            style={[
              styles.bloodPill,
              bloodGroup ? styles.bloodPillFilled : styles.bloodPillEmpty,
            ]}
          >
            <Text
              style={bloodGroup ? styles.bloodPillText : styles.bloodPillTextEmpty}
            >
              {bloodGroup ?? '—'}
            </Text>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.stripLabel}>ADDRESS</Text>
            <Text style={[styles.addressValue, styles.clip2]}>
              {idCardAddress(row)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.stripLabel}>
              {isStudent ? 'PARENT CONTACT' : 'CONTACT'}
            </Text>
            <Text style={[styles.stripValue, styles.clip1]}>
              {idCardContact(row, school)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Back ────────────────────────────────────────────────────────────────── */

export function IdCardBack({ card, school, assets }: FaceProps) {
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
            <Text style={[styles.backHolder, styles.clip1]}>{row.name}</Text>
            <Text style={[styles.backHolderMeta, styles.clip1]}>
              {idCardRoleLine(row)}
            </Text>

            <Text style={styles.eyebrow}>IF FOUND</Text>
            <Text style={styles.returnCopy}>
              Please return this card to the school office.
            </Text>
            {school.address ? (
              <Text style={[styles.returnDetail, styles.clip2]}>
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
            {assets.signatureDataUrl ? (
              <Image src={assets.signatureDataUrl} style={styles.signImage} />
            ) : (
              // No signature on file: leave the space so the office can sign
              // by hand, exactly as before the upload feature existed.
              <View style={styles.signSpacer} />
            )}
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
  assets,
}: {
  cards: PreparedIdCard[];
  school: IdCardBranding;
  assets: IdCardAssets;
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
              <IdCardFront card={card} school={school} assets={assets} />
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
                <IdCardBack card={card} school={school} assets={assets} />
              ) : null}
            </View>
          ))}
        </Sheet>,
      ])}
    </Document>
  );
}

/* ── Side by side: both faces of one card, on one row ────────────────────────
   The layout a school with an ordinary printer actually uses. Front and back
   land next to each other on ONE sheet, so you cut two rectangles and glue
   them back to back — no duplex printer, no second pass, and no chance of the
   back of card 3 ending up behind the front of card 4.

   The two faces are placed as a single row and never wrap: 2 × 242.65 pt plus
   an 18 pt gutter is 503.3 pt, comfortably inside A4's 595.28 pt. */

const PAIR_GAP = 18;
const PAIR_W = CARD_W * 2 + PAIR_GAP;
/** Four cards down an A4 sheet: 4 × 153.07 + gutters, plus the caption. */
export const PAIRS_PER_SHEET = 4;
const PAIR_ROW_GAP = 14;

const pair = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    paddingTop: 40,
    paddingBottom: 34,
    paddingHorizontal: (A4_W - PAIR_W) / 2,
  },
  row: { flexDirection: 'row', width: PAIR_W },
  gutter: { width: PAIR_GAP },
  rowGap: { height: PAIR_ROW_GAP },
  faceLabels: { flexDirection: 'row', width: PAIR_W, marginBottom: 4 },
  faceLabel: {
    width: CARD_W,
    fontFamily: 'Courier-Bold',
    fontSize: 5,
    letterSpacing: 0.8,
    color: INK_FAINT,
  },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK },
  subtitle: {
    fontFamily: 'Courier-Bold',
    fontSize: 6,
    letterSpacing: 0.8,
    color: INK_FAINT,
    marginTop: 5,
    marginBottom: 22,
  },
  caption: {
    fontFamily: 'Courier-Bold',
    fontSize: 5.5,
    letterSpacing: 0.5,
    color: INK_FAINT,
    marginBottom: 16,
  },
  note: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: INK_MUTED,
    marginTop: 22,
    lineHeight: 1.45,
  },
});

/** Both faces of one card, on one row, with FRONT / BACK called out above. */
function FacePair({
  card,
  school,
  assets,
  labelled,
}: FaceProps & { labelled?: boolean }) {
  return (
    <View wrap={false}>
      {labelled ? (
        <View style={pair.faceLabels}>
          <Text style={pair.faceLabel}>FRONT</Text>
          <View style={pair.gutter} />
          <Text style={pair.faceLabel}>BACK</Text>
        </View>
      ) : null}
      <View style={pair.row}>
        <IdCardFront card={card} school={school} assets={assets} />
        <View style={pair.gutter} />
        <IdCardBack card={card} school={school} assets={assets} />
      </View>
    </View>
  );
}

const PRINT_NOTE =
  'Print at 100% — do not select "fit to page", or the card will not match a ' +
  'standard CR80 holder. Cut along the hairline around each face, then glue ' +
  'the two back to back.';

/** One card, for a parent or a reprint — front and back on the same row. */
export function IdCardSingleDocument({
  card,
  school,
  assets,
}: {
  card: PreparedIdCard;
  school: IdCardBranding;
  assets: IdCardAssets;
}) {
  return (
    <Document title={`ID card — ${card.row.name}`} author={school.name}>
      <Page size="A4" style={pair.page}>
        <Text style={pair.title}>{card.row.name}</Text>
        <Text style={pair.subtitle}>
          {school.name.toUpperCase()}
          {school.session ? ` · ${school.session}` : ''}
        </Text>

        <FacePair
          card={card}
          school={school}
          assets={assets}
          labelled
        />

        <Text style={pair.note}>{PRINT_NOTE}</Text>
      </Page>
    </Document>
  );
}

/**
 * A print run laid out the same way: four cards a sheet, each one's front and
 * back side by side. Slower to finish by hand than duplex, but it works on
 * every printer in every school office — which is the point.
 */
export function IdCardPairBatchDocument({
  cards,
  school,
  assets,
}: {
  cards: PreparedIdCard[];
  school: IdCardBranding;
  assets: IdCardAssets;
}) {
  const sheets = chunk(cards, PAIRS_PER_SHEET);

  return (
    <Document
      title={`ID cards — ${school.name}`}
      author={school.name}
      subject="Printable identity cards"
    >
      {sheets.map((sheet, index) => (
        <Page key={`pair-${index}`} size="A4" style={pair.page}>
          <Text style={pair.caption}>
            {`Sheet ${index + 1} of ${sheets.length} · FRONT AND BACK SIDE BY SIDE · ${PRINT_NOTE}`}
          </Text>
          {sheet.map((card, i) => (
            <React.Fragment key={`p-${i}`}>
              {i > 0 ? <View style={pair.rowGap} /> : null}
              <FacePair
                card={card}
                school={school}
                assets={assets}
                labelled={i === 0}
              />
            </React.Fragment>
          ))}
        </Page>
      ))}
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
    return await toPdfSafeDataUrl(await res.blob());
  } catch {
    return null;
  }
}

/**
 * The school logo, made safe AND small.
 *
 * Two separate hazards: a format react-pdf cannot decode takes the whole
 * document down (a card with no logo is merely plainer), and a full-resolution
 * upload embedded at 20 pt is pure weight — one school's 1500 px logo was
 * 2 MB, more than every card on the sheet combined.
 */
async function safeLogoDataUrl(): Promise<string | null> {
  return toPdfSafeLogo(await getSchoolLogoDataUrl());
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
    const [qrDataUrl, proxied] = await Promise.all([
      QRCode.toDataURL(row.qrToken, {
        errorCorrectionLevel: 'M',
        margin: 0,
        // Oversampled: the QR prints at ~26 mm, and a crisp module edge is the
        // difference between a scan that works on the first try and one that
        // does not.
        width: 480,
        color: { dark: '#1c150dff', light: '#ffffffff' },
      }),
      loadIdCardPhoto(row),
    ]);
    // The proxy is the route that works; the presigned S3 URL is only tried
    // if the proxy is unavailable (an older API), and it usually fails on
    // CORS — hence the fallback rather than the other way round.
    const photoDataUrl =
      proxied ?? (row.photoUrl ? await toDataUrl(row.photoUrl) : null);
    done += 1;
    onProgress?.(done, rows.length);
    return { row, qrDataUrl, photoDataUrl };
  });
}

/**
 * Hands a generated PDF to the browser.
 *
 * Two things here are deliberate, and both are about phones:
 *
 * 1. THE REVOKE IS DELAYED. `a.click()` only *starts* the download; the
 *    browser reads the blob afterwards. Revoking the object URL on the next
 *    line is a race — desktop Chrome usually finishes first, a phone often
 *    does not, and the download dies silently with no error to catch. That is
 *    the whole bug: "works on my laptop, does nothing on my phone".
 *
 * 2. THERE IS A FALLBACK for browsers that ignore `download` on a blob URL
 *    (iOS Safari, and any installed PWA running standalone, where there is no
 *    tab strip to reveal that something opened). Opening the blob at least
 *    puts the PDF on screen, where the OS share sheet can save it.
 */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  // Checked on the prototype, not the instance: `'download' in a` narrows the
  // element to `never` in the else branch, since the DOM types insist every
  // anchor has it. The runtime is what we actually care about here.
  const canDownload = 'download' in HTMLAnchorElement.prototype;
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  if (!canDownload) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (!canDownload) {
    // Last resort: some standalone PWAs swallow the synthetic click entirely.
    window.open(url, '_blank', 'noopener');
  }

  // Long enough for even a slow device to have read the blob; the URL is
  // released when the tab goes away regardless.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'id-cards'
  );
}

/**
 * How a batch is arranged on paper.
 *
 * · `sideBySide` — each card's front and back next to each other on one row,
 *   four cards a sheet. Works on any printer; you cut and glue.
 * · `duplex` — whole sheets of fronts and whole sheets of backs, with the
 *   backs' columns mirrored for long-edge flipping. Fewer manual steps, but
 *   only for a school with a duplex printer.
 *
 * `sideBySide` is the default because it is the one that cannot go wrong.
 */
export type IdCardPrintLayout = 'sideBySide' | 'duplex';

export interface IdCardPdfOptions {
  fileName?: string;
  layout?: IdCardPrintLayout;
  onProgress?: (done: number, total: number) => void;
}

/** Cards that fit on one sheet under the given layout. */
export function cardsPerSheet(layout: IdCardPrintLayout): number {
  return layout === 'duplex' ? CARDS_PER_SHEET : PAIRS_PER_SHEET;
}

/**
 * Renders a document, and if the render throws, renders it AGAIN without any
 * photos or logo.
 *
 * react-pdf treats an image it cannot decode as fatal to the whole document,
 * not to that one image — so a single unreadable portrait used to turn into
 * "Could not build the PDF" for an entire class. A card with an initials tile
 * is a card; no PDF at all is a school that cannot print today. The caller is
 * told which happened so it can say so.
 */
async function renderWithImageFallback(
  cards: PreparedIdCard[],
  assets: IdCardAssets,
  build: (
    cards: PreparedIdCard[],
    assets: IdCardAssets,
  ) => React.ReactElement<DocumentProps>,
): Promise<{ blob: Blob; droppedImages: boolean }> {
  try {
    return {
      blob: await pdf(build(cards, assets)).toBlob(),
      droppedImages: false,
    };
  } catch {
    // Second attempt with NO images at all — portraits, logo and signature.
    // Any one of them can be the undecodable file, and a plain card beats no
    // card at all.
    const stripped = cards.map((card) => ({ ...card, photoDataUrl: null }));
    const noAssets: IdCardAssets = {
      logoDataUrl: null,
      signatureDataUrl: null,
    };
    return {
      blob: await pdf(build(stripped, noAssets)).toBlob(),
      droppedImages: true,
    };
  }
}

/** Resolves the school-level images a document needs, once. */
async function loadAssets(school: IdCardBranding): Promise<IdCardAssets> {
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    safeLogoDataUrl(),
    getSchoolSignature(school),
  ]);
  return { logoDataUrl, signatureDataUrl };
}

/** What a download did, so the UI can be honest about a degraded print. */
export interface IdCardPdfResult {
  /** Sheets of PAPER produced. */
  sheets: number;
  /** True when photos had to be dropped for the document to render at all. */
  droppedImages: boolean;
}

/** Batch print sheets. */
export async function downloadIdCardBatchPdf(
  rows: IdCardRow[],
  school: IdCardBranding,
  options: IdCardPdfOptions = {},
): Promise<IdCardPdfResult> {
  const layout = options.layout ?? 'sideBySide';
  const [cards, assets] = await Promise.all([
    prepareIdCards(rows, options.onProgress),
    loadAssets(school),
  ]);

  const { blob, droppedImages } = await renderWithImageFallback(
    cards,
    assets,
    (c, a) =>
      layout === 'duplex' ? (
        <IdCardBatchDocument cards={c} school={school} assets={a} />
      ) : (
        <IdCardPairBatchDocument cards={c} school={school} assets={a} />
      ),
  );

  saveBlob(
    blob,
    options.fileName ?? `id-cards-${slugify(school.name)}-${rows.length}.pdf`,
  );

  const sheets = Math.ceil(rows.length / cardsPerSheet(layout));
  return {
    // Duplex prints each sheet twice over — fronts, then backs.
    sheets: layout === 'duplex' ? sheets * 2 : sheets,
    droppedImages,
  };
}

/** One card, front and back side by side on a single A4 page. */
export async function downloadSingleIdCardPdf(
  row: IdCardRow,
  school: IdCardBranding,
  options: IdCardPdfOptions = {},
): Promise<IdCardPdfResult> {
  const [cards, assets] = await Promise.all([
    prepareIdCards([row], options.onProgress),
    loadAssets(school),
  ]);

  const { blob, droppedImages } = await renderWithImageFallback(
    cards,
    assets,
    (c, a) => (
      <IdCardSingleDocument card={c[0]} school={school} assets={a} />
    ),
  );

  saveBlob(blob, options.fileName ?? `id-card-${slugify(row.name)}.pdf`);
  return { sheets: 1, droppedImages };
}
